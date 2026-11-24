import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import type { FileSystem } from "../../kernel/file-system-port.ts";
import { readEveryEntry } from "../../kernel/file-system-port.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { createRecordingFrozenCommandGenerator, frozenGeneratorFailure } from "../fixtures/frozen-command-generator.fake.ts";
import type { FrozenCommandDiscovery } from "./ports/frozen-command.ts";
import { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments } from "./legacy-command-plan.ts";
import { renderFrozenCommandSet } from "./render-frozen-command-set.ts";

const folder = new URL("file:///output/");
const plan = { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments };
const fixture = (discovery: FrozenCommandDiscovery = { stages: [], scopes: {}, selected: [] }) => {
  const generator = createRecordingFrozenCommandGenerator(discovery);
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///output/skills/aidlc-init/SKILL.md": "on-disk init must not replace rendered markdown",
    "file:///output/skills/aidlc-compose/SKILL.md": "on-disk compose",
    "file:///output/skills/feature/SKILL.md": "on-disk feature",
    "file:///output/skills/first/SKILL.md": "on-disk first",
  } });
  const readTree = mock<FileSystem["readTree"]>(fileSystem.readTree);
  return { generator, readTree, request: { generator, output: { readTree }, folder, plan, stages: [], scopes: [] } };
};

test("shortcuts preserve fixed order and use rendered markdown rather than the captured SKILL text", async () => {
  const current = fixture();
  expect(await renderFrozenCommandSet(current.request)).toEqual({ failure: null, entries: [
    { subject: { concept: "orchestrator-skill", name: "aidlc-init" }, reason: null, files: [
      { nativeName: "aidlc-init", within: "SKILL.md", content: { kind: "text", text: "---\nname: aidlc-init\n---\nInit\n" }, mode: "regular" },
    ] },
    { subject: { concept: "orchestrator-skill", name: "aidlc-compose" }, reason: null, files: [
      { nativeName: "aidlc-compose", within: "SKILL.md", content: { kind: "text", text: "---\nname: aidlc-compose\n---\nCompose\n" }, mode: "regular" },
    ] },
  ] });
  expect(current.generator.calls()).toEqual(["discover", "init", "compose", "regenerate"]);
  expect(current.readTree).toHaveBeenCalledTimes(1);
  expect(current.readTree).toHaveBeenCalledWith({ folder, select: readEveryEntry });
});

test("stage selection uses the first duplicate slug and precedes selected scopes and shortcuts", async () => {
  const first = mock(() => "---\nname: first\n---\nFirst stage\n");
  const duplicate = mock(() => "must not be selected");
  const current = fixture({ stages: [{ slug: "stage", render: first }, { slug: "stage", render: duplicate }],
    scopes: { feature: { description: "Selected feature" } }, selected: ["feature"] });
  const rendering = await renderFrozenCommandSet({ ...current.request, stages: ["stage"], scopes: ["feature"] });
  expect(rendering.failure).toBeNull();
  expect(rendering.entries).toMatchObject([
    { subject: { concept: "stage-command", name: "stage" }, files: [{ nativeName: "first" }] },
    { subject: { concept: "scope-command", name: "feature" }, files: [{ nativeName: "feature" }] },
    { subject: { concept: "orchestrator-skill", name: "aidlc-init" } },
    { subject: { concept: "orchestrator-skill", name: "aidlc-compose" } },
  ]);
  expect(first).toHaveBeenCalledTimes(1);
  expect(duplicate).not.toHaveBeenCalled();
  expect(current.generator.calls()).toEqual(["discover", "scope:feature", "init", "compose", "regenerate"]);
});

test("absent stage and unselected scope remain absent entries with no broken-command failure", async () => {
  const current = fixture();
  const rendering = await renderFrozenCommandSet({ ...current.request, stages: ["missing"], scopes: ["unselected"] });
  expect(rendering.failure).toBeNull();
  expect(rendering.entries).toMatchObject([
    { subject: { concept: "stage-command", name: "missing" }, files: null, reason: null },
    { subject: { concept: "scope-command", name: "unselected" }, files: null, reason: null },
    { subject: { concept: "orchestrator-skill", name: "aidlc-init" } },
    { subject: { concept: "orchestrator-skill", name: "aidlc-compose" } },
  ]);
  expect(current.generator.calls()).toEqual(["discover", "init", "compose", "regenerate"]);
});

test("a selected absent scope retains its exact refusal and prevents regeneration and output reads", async () => {
  const current = fixture({ stages: [], scopes: {}, selected: ["missing"] });
  expect(await renderFrozenCommandSet({ ...current.request, scopes: ["missing"] })).toEqual({ failure: null,
    entries: [{ subject: { concept: "scope-command", name: "missing" }, files: null,
      reason: "The selected frozen scope is absent: missing" }] });
  expect(current.generator.calls()).toEqual(["discover", "init", "compose"]);
  expect(current.readTree).not.toHaveBeenCalled();
});

test("duplicate native destinations win over an earlier broken renderer", async () => {
  const current = fixture({ stages: [
    { slug: "broken", render: () => frozenGeneratorFailure(new Error("earlier renderer failure")) },
    { slug: "one", render: () => "name: same\nOne" }, { slug: "two", render: () => "name: same\nTwo" },
  ], scopes: {}, selected: [] });
  expect(await renderFrozenCommandSet({ ...current.request, stages: ["broken", "one", "two"] }))
    .toEqual({ failure: null, entries: [{ subject: { concept: "stage-command", name: "two" }, files: null,
      reason: "Two frozen commands share the native destination: same" }] });
  expect(current.generator.calls()).toEqual(["discover", "init", "compose"]);
  expect(current.readTree).not.toHaveBeenCalled();
});

test("missing native name keeps the exact per-command failure and prevents output work", async () => {
  const current = fixture({ stages: [{ slug: "broken", render: () => "No native name" }], scopes: {}, selected: [] });
  expect(await renderFrozenCommandSet({ ...current.request, stages: ["broken"] })).toEqual({ failure: null,
    entries: [{ subject: { concept: "stage-command", name: "broken" }, files: null,
      reason: "The frozen command has no native name." }] });
  expect(current.readTree).not.toHaveBeenCalled();
});

test("a thrown renderer retains its exact reason as the first broken command", async () => {
  const current = fixture({ stages: [{ slug: "broken", render: () => frozenGeneratorFailure(new Error("exact renderer reason")) }],
    scopes: {}, selected: [] });
  expect(await renderFrozenCommandSet({ ...current.request, stages: ["broken"] })).toEqual({ failure: null,
    entries: [{ subject: { concept: "stage-command", name: "broken" }, files: null, reason: "exact renderer reason" }] });
  expect(current.readTree).not.toHaveBeenCalled();
});

test("regeneration precedes the single output read and companion bytes retain input tree order", async () => {
  const current = fixture();
  const regenerate = mock(current.generator.regenerate);
  current.readTree.mockResolvedValue(accepted({ unreadable: [], files: [
      { path: source("skills/aidlc-init/z.bin"), content: { kind: "bytes", bytes: new Uint8Array([0, 255, 195, 40]) } },
      { path: source("skills/aidlc-init/SKILL.md"), content: { kind: "text", text: "Ignored capture" } },
      { path: source("skills/aidlc-init/a.txt"), content: { kind: "text", text: "A\r\n" } },
      { path: source("skills/aidlc-compose/SKILL.md"), content: { kind: "text", text: "Compose capture" } },
    ] }));
  const rendering = await renderFrozenCommandSet({ ...current.request, generator: { ...current.generator, regenerate } });
  expect(regenerate).toHaveBeenCalledTimes(1);
  expect(regenerate.mock.invocationCallOrder[0]).toBeLessThan(current.readTree.mock.invocationCallOrder[0] ?? -1);
  expect(rendering.entries[0]?.files).toEqual([
    { nativeName: "aidlc-init", within: "SKILL.md", mode: "regular",
      content: { kind: "text", text: "---\nname: aidlc-init\n---\nInit\n" } },
    { nativeName: "aidlc-init", within: "z.bin", mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 195, 40]) } },
    { nativeName: "aidlc-init", within: "a.txt", mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([65, 13, 10]) } },
  ]);
});

test("output tree refusal and unreadable entries retain exact whole-set failure order", async () => {
  const current = fixture();
  current.readTree.mockResolvedValueOnce(refused({ kind: "unreadable", code: "permission-denied" }));
  expect(await renderFrozenCommandSet(current.request)).toEqual({ entries: [],
    failure: "The frozen runner output could not be read: permission-denied" });
  current.readTree.mockResolvedValueOnce(accepted({ files: [], unreadable: [
    { within: "z.bin", code: "not-found" }, { within: "a.bin", code: "permission-denied" },
  ] }));
  expect(await renderFrozenCommandSet(current.request)).toEqual({ entries: [],
    failure: "The frozen runner output could not be read: z.bin: not-found\nThe frozen runner output could not be read: a.bin: permission-denied" });
});

test("unexpected discovery and regeneration exceptions escape unchanged for the child edge to frame", async () => {
  const current = fixture();
  const discoveryFailure = new Error("discovery exception");
  await expect(renderFrozenCommandSet({ ...current.request, generator: { ...current.generator,
    discover: () => frozenGeneratorFailure(discoveryFailure) } })).rejects.toBe(discoveryFailure);
  const regenerationFailure = new Error("regeneration exception");
  await expect(renderFrozenCommandSet({ ...current.request, generator: { ...current.generator,
    regenerate: () => frozenGeneratorFailure(regenerationFailure) } })).rejects.toBe(regenerationFailure);
  expect(current.readTree).not.toHaveBeenCalled();
});
