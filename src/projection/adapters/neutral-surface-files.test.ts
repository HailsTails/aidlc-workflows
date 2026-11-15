import { source } from "../../kernel/fixtures/values.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { createNeutralReading } from "./neutral-surface-files.ts";
import { refused } from "../../kernel/result.ts";

const core = new URL("file:///core/");
const files = {
  "file:///core/aidlc-common/conductor.md": "Conductor",
  "file:///core/aidlc-common/protocols/one.md": "Protocol",
  "file:///core/aidlc-common/protocols/ignored.ts": "ignored",
  "file:///core/templates/onboarding.md": "Neutral",
  "file:///core/templates/onboarding-harness.md": "Harness",
};
const sources = [
  { owner: { kind: "core" as const }, path: methodSource({ kind: "stage", within: "phase/task.md" }),
    content: { kind: "bytes" as const, bytes: new Uint8Array([83]) } },
  { owner: { kind: "core" as const }, path: methodSource({ kind: "knowledge", within: "guide.md" }),
    content: { kind: "text" as const, text: "Knowledge" } },
  { owner: { kind: "core" as const }, path: methodSource({ kind: "agent", within: "worker.md" }),
    content: { kind: "text" as const, text: "Outside documents" } },
];

test("neutral capture reads only neutral inputs and wraps admitted stage and knowledge bytes", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const readFile = mock(fileSystem.readFile);
  const readTree = mock(fileSystem.readTree);
  const surface = accept(await createNeutralReading({ files: { readFile }, tree: { readTree } })({ hookGuidance: "legacy-authored", core, sources }));
  expect(surface).toEqual({ documents: [
    { source: source("aidlc-common/conductor.md"), role: "conductor", content: { kind: "text", text: "Conductor" } },
    { source: source("aidlc-common/protocols/one.md"), role: "protocol",
      content: { kind: "bytes", bytes: new Uint8Array([80, 114, 111, 116, 111, 99, 111, 108]) } },
    { source: source("aidlc-common/stages/phase/task.md"), role: "stage",
      content: { kind: "bytes", bytes: new Uint8Array([83]) } },
    { source: source("knowledge/guide.md"), role: "knowledge", content: { kind: "text", text: "Knowledge" } },
  ], skills: [], onboarding: { hookGuidance: "legacy-authored" as const, neutral: "Neutral", harnessSkeleton: "Harness" } });
  expect(readFile).toHaveBeenCalledTimes(3);
  expect(readTree).toHaveBeenCalledTimes(1);
});

test("captured Method bytes cannot be mutated through the source snapshot", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const bytes = new Uint8Array([0, 255]);
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ hookGuidance: "legacy-authored", core,
    sources: [{ owner: { kind: "core" }, path: methodSource({ kind: "knowledge", within: "binary.md" }),
      content: { kind: "bytes", bytes } }] }));
  bytes[0] = 42;
  expect(surface.documents[2]).toEqual({ source: source("knowledge/binary.md"), role: "knowledge",
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } });
});

test("every unreadable neutral file is returned without accepting a partial surface", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: {
    "file:///core/aidlc-common/conductor.md": "permission-denied",
    "file:///core/aidlc-common/protocols/one.md": "not-a-file",
    "file:///core/templates/onboarding-harness.md": "failed",
  } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ hookGuidance: "legacy-authored", core, sources: [] }))
    .toEqual({ ok: false, refusal: [
      { kind: "neutral-source-unreadable", source: source("aidlc-common/conductor.md"), reason: "permission-denied" },
      { kind: "neutral-source-unreadable", source: source("templates/onboarding-harness.md"), reason: "failed" },
      { kind: "neutral-source-unreadable", source: source("aidlc-common/protocols/one.md"), reason: "not-a-file" },
    ] });
});

test.each(["copy-looking text", "{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "legacy capture snapshots %s without inferring guidance", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({
      hookGuidance: "legacy-authored", core, sources: [] }));
    expect(surface.onboarding).toEqual({ neutral: "Neutral", harnessSkeleton: skeleton, hookGuidance: "legacy-authored" });
  });
test("declared capture retains exact CRLF bytes alongside explicit guidance", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/templates/onboarding-harness.md": "Before\r\n{{SLOT:framework_hook_runtime}}\r\nAfter\r\n" } });
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({
    hookGuidance: "framework-hooks", core, sources: [] }));
  expect(surface.onboarding).toEqual({ neutral: "Neutral", hookGuidance: "framework-hooks",
    harnessSkeleton: "Before\r\n{{SLOT:framework_hook_runtime}}\r\nAfter\r\n" });
});
test.each(["Missing", "{{SLOT:framework_hook_runtime}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "declared capture refuses %s after reads", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({
      hookGuidance: "framework-hooks", core, sources: [] })).toEqual(refused([{ kind: "render-failed",
      concept: "onboarding", name: "onboarding-harness.md",
      reason: "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker." }]));
  });
test("ordinary source read failure precedes declared-slot admission", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: {
    "file:///core/aidlc-common/conductor.md": "permission-denied" } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ hookGuidance: "framework-hooks", core, sources: [] }))
    .toEqual(refused([{ kind: "neutral-source-unreadable", source: source("aidlc-common/conductor.md"), reason: "permission-denied" }]));
});
