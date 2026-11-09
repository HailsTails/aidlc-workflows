import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../../../kernel/fixtures/file-system.fake.ts";
import type { FileSystem } from "../../../../kernel/file-system-port.ts";
import { runChild, runChildWithCapability } from "./legacy-runner-child.ts";

const plan = (): Parameters<typeof runChild>[0]["plan"] => ({
  duplicateNativeCommand: () => null,
  selectedScopeDescription: () => accepted(null),
  selectLegacyDocuments: () => accepted({ skill: "", companions: [] }),
});
const input = { module: "file:///module.ts", output: "file:///output/", stages: [], scopes: [] };
const generator = {
  runnableStages: () => [], discoverScopes: () => ({}), defaultScopeBatch: () => [],
  renderStageRunner: () => "Unused stage", renderRunner: () => "Unused scope",
  renderInitRunner: () => "---\nname: aidlc-init\n---\nInit\n",
  renderComposeRunner: () => "---\nname: aidlc-compose\n---\nCompose\n",
  regenerateRunnerSurfaces: () => undefined,
};

test("invalid child input returns failure data before loading a module or reading output", async () => {
  const load = mock(async () => generator);
  const readTree = mock<FileSystem["readTree"]>(async () => accepted({ files: [], unreadable: [] }));
  expect(await runChild({ plan: plan(), raw: null, output: { readTree }, load }))
    .toEqual({ entries: [], failure: "The frozen runner request is invalid." });
  expect(load).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
});

test("the child refuses non-file module locations before loading", async () => {
  const load = mock(async () => generator);
  expect(await runChild({ plan: plan(), raw: { ...input, module: "https://example.invalid/module.ts" },
    output: createInMemoryFileSystem({ files: {} }), load }))
    .toEqual({ entries: [], failure: "The frozen runner request is invalid." });
  expect(load).not.toHaveBeenCalled();
});

test("an invalid child capability API returns a whole-source failure", async () => {
  expect(await runChildWithCapability({ plan: plan(), input, capability: {}, output: createInMemoryFileSystem({ files: {} }) }))
    .toEqual({ entries: [], failure: "The frozen runner capability API is invalid." });
});

test("an absent selected scope is refused before child output is written or read", async () => {
  const regenerateRunnerSurfaces = mock(() => undefined);
  const readTree = mock<FileSystem["readTree"]>(async () => accepted({ files: [], unreadable: [] }));
  expect(await runChildWithCapability({ input: { ...input, scopes: ["feature"] },
    plan: { ...plan(), selectedScopeDescription: () => refused("The selected frozen scope is absent: feature") },
    capability: { ...generator, defaultScopeBatch: () => ["feature"], regenerateRunnerSurfaces },
    output: { readTree } })).toEqual({ failure: null, entries: [
      { subject: { concept: "scope-command", name: "feature" }, files: null,
        reason: "The selected frozen scope is absent: feature" },
    ] });
  expect(regenerateRunnerSurfaces).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
});

test("the real child boundary loads once and captures binary companions through the output port", async () => {
  const regenerateRunnerSurfaces = mock(() => undefined);
  const load = mock(async () => ({ ...generator, regenerateRunnerSurfaces }));
  const output = createInMemoryFileSystem({ files: {
    "file:///output/skills/aidlc-init/SKILL.md": "Captured init file",
    "file:///output/skills/aidlc-init/nested/asset.bin": new Uint8Array([0, 255, 195, 40]),
    "file:///output/skills/aidlc-compose/SKILL.md": "Captured compose file",
  } });
  expect(await runChild({ plan: { ...plan(), selectLegacyDocuments: mock()
    .mockReturnValueOnce(accepted({ skill: "skills/aidlc-init/SKILL.md", companions: [
      { path: "skills/aidlc-init/nested/asset.bin", within: "nested/asset.bin" },
    ] }))
    .mockReturnValueOnce(accepted({ skill: "skills/aidlc-compose/SKILL.md", companions: [] })) },
    raw: input, output, load })).toEqual({ failure: null, entries: [
    { subject: { concept: "orchestrator-skill", name: "aidlc-init" }, reason: null, files: [
      { nativeName: "aidlc-init", within: "SKILL.md", mode: "regular",
        content: { kind: "text", text: "---\nname: aidlc-init\n---\nInit\n" } },
      { nativeName: "aidlc-init", within: "nested/asset.bin", mode: "regular",
        content: { kind: "bytes", bytes: [0, 255, 195, 40] } },
    ] },
    { subject: { concept: "orchestrator-skill", name: "aidlc-compose" }, reason: null, files: [
      { nativeName: "aidlc-compose", within: "SKILL.md", mode: "regular",
        content: { kind: "text", text: "---\nname: aidlc-compose\n---\nCompose\n" } },
    ] },
  ] });
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(new URL("file:///module.ts"));
  expect(regenerateRunnerSurfaces).toHaveBeenCalledTimes(1);
});

test("an output file fault remains subjectless and names the failed companion", async () => {
  const output = createInMemoryFileSystem({ files: {
    "file:///output/skills/aidlc-init/SKILL.md": "Init",
    "file:///output/skills/aidlc-compose/SKILL.md": "Compose",
  }, faults: { "file:///output/skills/aidlc-init/companion.bin": "permission-denied" } });
  expect(await runChildWithCapability({ plan: plan(), input, capability: generator, output })).toEqual({ entries: [],
    failure: "The frozen runner output could not be read: skills/aidlc-init/companion.bin: permission-denied" });
});

test("the injected collision decision stops generation before output is read", async () => {
  const collision = { subject: { concept: "orchestrator-skill" as const, name: "aidlc-compose" },
    files: null, reason: "The owning plan refused this destination." };
  const regenerateRunnerSurfaces = mock(() => undefined);
  const readTree = mock<FileSystem["readTree"]>(async () => accepted({ files: [], unreadable: [] }));
  expect(await runChildWithCapability({ input, capability: { ...generator, regenerateRunnerSurfaces },
    output: { readTree }, plan: { ...plan(), duplicateNativeCommand: () => collision } }))
    .toEqual({ failure: null, entries: [collision] });
  expect(regenerateRunnerSurfaces).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
});