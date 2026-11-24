import { source } from "../../kernel/fixtures/values.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { createNeutralReading } from "./neutral-surface-files.ts";
import { refused } from "../../kernel/result.ts";
import { bindCwdDocuments, type CwdGuidanceSource } from "../domain/cwd-guidance.ts";
import type { AuthoredOnboardingSource } from "../domain/onboarding-source.ts";
import type { CapturedNeutralSurface } from "../domain/neutral-surface.ts";

type ObservableCapture = Omit<CapturedNeutralSurface, "onboarding" | "documents"> & {
  readonly onboarding: AuthoredOnboardingSource;
  readonly documents: Pick<CapturedNeutralSurface["documents"], "documents" | "guidance">;
};

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
  const surface = accept(await createNeutralReading({ files: { readFile }, tree: { readTree } })({ cwdGuidance: { kind: "legacy-authored" }, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" as const, core, sources }));
  expect(surface).toEqual<ObservableCapture>({ documents: { guidance: { kind: "legacy-authored" }, documents: [
    { source: source("aidlc-common/conductor.md"), role: "conductor", content: { kind: "text", text: "Conductor" } },
    { source: source("aidlc-common/protocols/one.md"), role: "protocol",
      content: { kind: "bytes", bytes: new Uint8Array([80, 114, 111, 116, 111, 99, 111, 108]) } },
    { source: source("aidlc-common/stages/phase/task.md"), role: "stage",
      content: { kind: "bytes", bytes: new Uint8Array([83]) } },
    { source: source("knowledge/guide.md"), role: "knowledge", content: { kind: "text", text: "Knowledge" } },
   ] }, skills: [], onboarding: { hookGuidance: "legacy-authored" as const, toolsGuidance: "legacy-authored" as const, neutral: "Neutral", harnessSkeleton: "Harness" } });
  expect(readFile).toHaveBeenCalledTimes(3);
  expect(readTree).toHaveBeenCalledTimes(1);
});

test("captured Method bytes cannot be mutated through the source snapshot", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const bytes = new Uint8Array([0, 255]);
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" as const, core,
    sources: [{ owner: { kind: "core" }, path: methodSource({ kind: "knowledge", within: "binary.md" }),
      content: { kind: "bytes", bytes } }] }));
  bytes[0] = 42;
  expect(surface.documents.documents[2]).toEqual({ source: source("knowledge/binary.md"), role: "knowledge",
    content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } });
});

test("every unreadable neutral file is returned without accepting a partial surface", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: {
    "file:///core/aidlc-common/conductor.md": "permission-denied",
    "file:///core/aidlc-common/protocols/one.md": "not-a-file",
    "file:///core/templates/onboarding-harness.md": "failed",
  } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" as const, core, sources: [] }))
    .toEqual({ ok: false, refusal: [
      { kind: "neutral-source-unreadable", source: source("aidlc-common/conductor.md"), reason: "permission-denied" },
      { kind: "neutral-source-unreadable", source: source("templates/onboarding-harness.md"), reason: "failed" },
      { kind: "neutral-source-unreadable", source: source("aidlc-common/protocols/one.md"), reason: "not-a-file" },
    ] });
});

test("explicit CWD declaration is admitted with raw protocol bytes, not inferred for other documents", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/aidlc-common/protocols/one.md": "Before\r\n{{SLOT:framework_cwd_guidance}}\r\nAfter" } });
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ core, sources,
    hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored",
    cwdGuidance: { kind: "framework-cwd", source: "aidlc-common/protocols/one.md" } }));
  expect(surface.documents.guidance).toEqual<CwdGuidanceSource>({ kind: "framework-cwd", source: "aidlc-common/protocols/one.md" });
  expect(bindCwdDocuments({ captured: surface.documents, channel: "native" })[1]).toEqual({
    source: source("aidlc-common/protocols/one.md"), role: "protocol", content: { kind: "text", text:
      "Before\r\n**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.\r\nAfter" } });
  expect(surface.documents.documents[1]?.content).toEqual({ kind: "bytes", bytes: new TextEncoder().encode("Before\r\n{{SLOT:framework_cwd_guidance}}\r\nAfter") });
});
test.each(["Missing", "{{SLOT:framework_cwd_guidance}", "{{SLOT:framework_cwd_guidance}}{{SLOT:framework_cwd_guidance}}"])(
  "captured CWD position refusal precedes later invalid neutral rendering: %s", async (text) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding.md": "{{UNKNOWN}}",
      "file:///core/aidlc-common/protocols/one.md": text } });
    expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ core, sources: [],
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored",
      cwdGuidance: { kind: "framework-cwd", source: "aidlc-common/protocols/one.md" } })).toEqual(refused([{ kind: "render-failed",
      concept: "neutral-document", name: "aidlc-common/protocols/one.md",
      reason: "Declared CWD guidance requires exactly one {{SLOT:framework_cwd_guidance}} position." }]));
  });
test("existing Hook admission refusal precedes a simultaneously invalid CWD declaration", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ core, sources: [],
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools",
    cwdGuidance: { kind: "framework-cwd", source: "aidlc-common/protocols/one.md" } })).toEqual(refused([{ kind: "render-failed",
    concept: "onboarding", name: "onboarding-harness.md",
    reason: "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker." }]));
});
test("ordinary protocol read failure precedes CWD admission", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: { "file:///core/aidlc-common/protocols/one.md": "permission-denied" } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ core, sources: [],
    hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored",
    cwdGuidance: { kind: "framework-cwd", source: "aidlc-common/protocols/one.md" } })).toEqual(refused([{ kind: "neutral-source-unreadable",
    source: source("aidlc-common/protocols/one.md"), reason: "permission-denied" }]));
});

test.each(['{"kind":"framework-cwd"}', '{"kind":"framework-cwd","source":null}', '{"kind":"framework-cwd","source":17}'])(
  "malformed CWD author source retains a string diagnostic name: %s", async (json) => {
    const fileSystem = createInMemoryFileSystem({ files });
    expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ core, sources: [],
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored", cwdGuidance: JSON.parse(json) }))
      .toEqual(refused([{ kind: "render-failed", concept: "neutral-document", name: "cwd-guidance",
        reason: "The declared CWD protocol source must be a portable source path." }]));
  });

test.each(["copy-looking text", "{{SLOT:framework_hook_runtime}}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "legacy capture snapshots %s without inferring guidance", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" },
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" as const, core, sources: [] }));
    expect(surface.onboarding).toEqual<AuthoredOnboardingSource>({ neutral: "Neutral", harnessSkeleton: skeleton, hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" as const });
  });
test("declared capture retains exact CRLF bytes alongside explicit guidance", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/templates/onboarding-harness.md": "Before\r\n{{SLOT:framework_hook_runtime}}\r\nAfter\r\n" } });
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" },
    hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" as const, core, sources: [] }));
  expect(surface.onboarding).toEqual<AuthoredOnboardingSource>({ neutral: "Neutral", hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" as const,
    harnessSkeleton: "Before\r\n{{SLOT:framework_hook_runtime}}\r\nAfter\r\n" });
});
test.each(["Missing", "{{SLOT:framework_hook_runtime}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_hook_runtime}}"])(
  "declared capture refuses %s after reads", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" },
      hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" as const, core, sources: [] })).toEqual(refused([{ kind: "render-failed",
      concept: "onboarding", name: "onboarding-harness.md",
      reason: "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker." }]));
  });
test("ordinary source read failure precedes declared-slot admission", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: {
    "file:///core/aidlc-common/conductor.md": "permission-denied" } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" as const, core, sources: [] }))
    .toEqual(refused([{ kind: "neutral-source-unreadable", source: source("aidlc-common/conductor.md"), reason: "permission-denied" }]));
});

test("Tools may be declared while Hook remains legacy and raw CRLF remains intact", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/templates/onboarding-harness.md": "{{SLOT:framework_tools_runtime}}\r\nHook prose\r\n" } });
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" },
    core, sources: [], hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" }));
  expect(surface.onboarding).toEqual<AuthoredOnboardingSource>({ neutral: "Neutral", hookGuidance: "legacy-authored", toolsGuidance: "framework-tools",
    harnessSkeleton: "{{SLOT:framework_tools_runtime}}\r\nHook prose\r\n" });
});
test("both explicit meanings retain their independent declarations and slot order", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/templates/onboarding-harness.md": "{{SLOT:framework_tools_runtime}}\n{{SLOT:framework_hook_runtime}}" } });
  const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" },
    core, sources: [], hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" }));
  expect(surface.onboarding).toEqual<AuthoredOnboardingSource>({ neutral: "Neutral", hookGuidance: "framework-hooks", toolsGuidance: "framework-tools",
    harnessSkeleton: "{{SLOT:framework_tools_runtime}}\n{{SLOT:framework_hook_runtime}}" });
});
test("the existing Hook refusal precedes new Tools refusal when both declarations are invalid", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, core, sources: [],
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" })).toEqual(refused([{ kind: "render-failed",
    concept: "onboarding", name: "onboarding-harness.md",
    reason: "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker." }]));
});
test.each(["Missing Tools {{SLOT:framework_hook_runtime}}", "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}",
  "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "valid Hook does not authorize malformed Tools: %s", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, core, sources: [],
      hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" })).toEqual(refused([{ kind: "render-failed",
      concept: "onboarding", name: "onboarding-harness.md",
      reason: "Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker." }]));
  });
test("ordinary read failure precedes both invalid declarations", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: { "file:///core/aidlc-common/conductor.md": "permission-denied" } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, core, sources: [],
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" })).toEqual(refused([{ kind: "neutral-source-unreadable",
    source: source("aidlc-common/conductor.md"), reason: "permission-denied" }]));
});

test.each([
  ["Missing", "Declared framework Hook guidance requires exactly one {{SLOT:framework_hook_runtime}} marker."],
  ["{{SLOT:framework_hook_runtime}}", "Declared framework Tools guidance requires exactly one {{SLOT:framework_tools_runtime}} marker."],
])("captured admission owns malformed source precedence over later neutral markers: %s", async (harnessSkeleton, reason) => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/templates/onboarding.md": "{{UNKNOWN}}",
    "file:///core/templates/onboarding-harness.md": harnessSkeleton } });
  expect(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, core, sources: [],
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" })).toEqual(refused([{ kind: "render-failed",
    concept: "onboarding", name: "onboarding-harness.md", reason }]));
});
test.each(["{{SLOT:framework_tools_runtime}}", "{{SLOT:framework_tools_runtime}}{{SLOT:framework_tools_runtime}}"])(
  "legacy capture does not promote the Tools slot spelling %s", async (skeleton) => {
    const fileSystem = createInMemoryFileSystem({ files: { ...files,
      "file:///core/templates/onboarding-harness.md": skeleton } });
    const surface = accept(await createNeutralReading({ files: fileSystem, tree: fileSystem })({ cwdGuidance: { kind: "legacy-authored" }, core, sources: [],
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" }));
    expect(surface.onboarding).toEqual<AuthoredOnboardingSource>({ neutral: "Neutral", harnessSkeleton: skeleton,
      hookGuidance: "legacy-authored", toolsGuidance: "legacy-authored" });
  });
