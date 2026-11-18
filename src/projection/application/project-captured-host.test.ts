import { PERMISSION_POLICIES_FIXTURE } from "../fixtures/onboarding-permissions.fixture.ts";
import { brand } from "../../kernel/brand.ts";
import { prepareOnboardingContext, type OnboardingPermissions } from "../domain/onboarding-context.ts";
import { admitCwdDocuments } from "../domain/cwd-guidance.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { admitOnboardingSource } from "../domain/onboarding-source.ts";
import type { HostFileDeriver } from "./ports/harness.ts";
import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { agent } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { SCRATCH_HOST, SCRATCH_TOKENS, SCRATCH_HOST_DATA, scratchAgentRenderer, scratchCommandPlacement,
  scratchSkillRenderer, scratchSettingsRenderer, scratchDocumentRenderer } from "../fixtures/scratch-host.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import type { Harness, Rendering } from "./ports/harness.ts";
import type { CapturedHostProjectionPorts, CapturedHostProjectionRequest, CapturedMethodCompiler,
  HostProjectionMember } from "./ports/captured-host.ts";
import type { FullHostCapture } from "./ports/build-sources.ts";
import type { ProjectMethodForHarness } from "./use-cases.ts";
import { createProjectCapturedHost } from "./project-captured-host.ts";
import { commonHarnessRecord } from "../domain/harness-record.ts";

const nothing = (): Rendering => accepted([]);
const tokens = tokenBindingsFixture({ harnessDir: ".scratch" });
const harness: Harness = { tokens, renderAgent: nothing, renderConductorAgent: nothing, renderStageCommand: nothing,
  renderScopeCommand: nothing, renderOrchestratorSkill: nothing, renderSessionSkill: nothing, renderSettings: nothing,
  renderHookRegistrations: nothing, renderOnboarding: nothing, renderHostData: nothing, placeNeutralDocument: nothing,
  placeAuthoredFile: nothing, deriveFiles: nothing };
const renderData = () => SCRATCH_HOST_DATA;
const member: HostProjectionMember = { host: SCRATCH_HOST, projection: {
  tokens: SCRATCH_TOKENS, renderData, record: commonHarnessRecord, tierFlavor: "claude",
  placements: [{ source: "required.md", destination: ".scratch/required.md" }],
  agents: { inputs: [], render: scratchAgentRenderer }, commands: scratchCommandPlacement,
  skills: { inputs: [], render: scratchSkillRenderer }, settings: { inputs: [], render: scratchSettingsRenderer },
  documents: { inputs: [], render: scratchDocumentRenderer }, fills: () => ({ invoke: "/aidlc", slots: {} }), bindingHeading: "Scratch",
} };
const other: HostProjectionMember = { host: host({ name: "other", directory: ".other" }),
  projection: { ...member.projection, bindingHeading: "Other" } };
const nativeCommands = { prefix: "aidlc engine", namespace: "engine", delegates: [], adapterHooks: new Set<string>(),
  trusted: () => "unused", unresolvable: () => [] };
const compiled = { graph: "captured graph", grid: "captured grid" };
const captured: FullHostCapture = { surface: { documents: accept(admitCwdDocuments({ documents: [], guidance: { kind: "legacy-authored" } })), skills: [], onboarding: accept(admitOnboardingSource({ hookGuidance: "legacy-authored" as const, toolsGuidance: "legacy-authored" as const, neutral: "Neutral", harnessSkeleton: "Host" })) },
  runtime: { files: [], version: { kind: "text", text: "Version" }, agentTiers: { kind: "text", text: "Tiers" },
    settingsSchema: { kind: "text", text: "Schema" } }, companions: [] };
const requiredFile = { source: source("required.md"), content: { kind: "text" as const, text: "Required\r\n" } };
const unusedFile = { source: source("unplaced.md"), content: { kind: "bytes" as const, bytes: new Uint8Array([0, 255]) } };
const projected = { host: SCRATCH_HOST, files: [{ path: path(".scratch/required.md"), mode: "regular" as const,
  content: { kind: "text" as const, text: "Projected\r\n" }, origin: { kind: "harness-authored" as const,
    source: source("required.md") } }], findings: [] };
const completion = accepted(projected);

const fixture = (members: readonly HostProjectionMember[] = [member, other]) => {
  const compile = mock<CapturedMethodCompiler>().mockReturnValue(accepted(compiled));
  const capture = mock<CapturedHostProjectionPorts["capture"]>().mockResolvedValue(accepted(captured));
  const assemble = mock<CapturedHostProjectionPorts["assemble"]>().mockResolvedValue(accepted(harness));
  const project = mock<ProjectMethodForHarness["project"]>().mockResolvedValue(completion);
  const hosted = mock<CapturedHostProjectionPorts["hosted"]>().mockReturnValue({ project });
  const request: CapturedHostProjectionRequest = { host: SCRATCH_HOST,
    core: { method: methodSliceFixture, sources: [] }, compile, files: [requiredFile, unusedFile], prepare: accepted,
    tokens, onboarding: { channel: "copy" }, nativeReplacements: [], modelCap: "balanced", entrypoints: [source("tools/aidlc.ts")],
    projectRoot: new URL("file:///project/"), reviewerAgents: new Set([agent("reviewer")]) };
  return { compile, capture, assemble, project, hosted, request,
    projectHost: createProjectCapturedHost({ members, capture, assemble, hosted,
      nativeCommands }) };
};

const nativeContext = prepareOnboardingContext({ context: { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: PERMISSION_POLICIES_FIXTURE["prefix-only"], prefix: "aidlc engine",
}) }, skeleton: "" });

test("the real first caller binds declared native guidance before assembly using the captured declaration", async () => {
  const current = fixture();
  current.capture.mockResolvedValue(accepted({ ...captured, surface: { ...captured.surface,
    onboarding: accept(admitOnboardingSource({ neutral: "Neutral", harnessSkeleton: "{{SLOT:framework_hook_runtime}}", hookGuidance: "framework-hooks", toolsGuidance: "legacy-authored" as const })) } }));
  await current.projectHost({ ...current.request, onboarding: nativeContext });
  expect(current.assemble.mock.calls[0]?.[0].fills).toEqual({ invoke: "/aidlc", slots: {} });
  expect(current.project.mock.calls[0]?.[0].surface.onboarding.harnessSkeleton)
    .toBe("- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.");
  expect(current.capture).toHaveBeenCalledTimes(1);
});

test("the first caller binds Tools independently while Hook keeps custom legacy meaning", async () => {
  const fills = { invoke: "/custom", slots: { ["framework_hook_runtime"]: "Custom Hook", ["framework_tools_runtime"]: "Custom Tools" } };
  const current = fixture([{ ...member, projection: { ...member.projection, fills: () => fills } }]);
  current.capture.mockResolvedValue(accepted({ ...captured, surface: { ...captured.surface, onboarding: accept(admitOnboardingSource({
    neutral: "Neutral", harnessSkeleton: "{{SLOT:framework_tools_runtime}}", hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" })) } }));
  await current.projectHost({ ...current.request, onboarding: nativeContext });
  expect(current.assemble.mock.calls[0]?.[0].fills).toBe(fills);
  expect(current.project.mock.calls[0]?.[0].surface.onboarding).toEqual<unknown>({ neutral: "Neutral",
    harnessSkeleton: "TypeScript sources invoked through the self-contained `aidlc` runtime",
    copyAuthoring: { neutral: "Neutral", harnessSkeleton: "TypeScript, run via bun" },
    nativeDialect: { host: member.host, commands: nativeCommands, replacements: [], permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"],
      captured: { neutral: "Neutral", harnessSkeleton: "{{SLOT:framework_tools_runtime}}",
        hookGuidance: "legacy-authored", toolsGuidance: "framework-tools" } } });
  expect(fills).toEqual({ invoke: "/custom", slots: { ["framework_hook_runtime"]: "Custom Hook", ["framework_tools_runtime"]: "Custom Tools" } });
});
test("the first caller composes both declared meanings without changing their owned positions", async () => {
  const current = fixture();
  current.capture.mockResolvedValue(accepted({ ...captured, surface: { ...captured.surface, onboarding: accept(admitOnboardingSource({
    neutral: "Neutral", harnessSkeleton: "{{SLOT:framework_hook_runtime}}{{SLOT:framework_tools_runtime}}",
    hookGuidance: "framework-hooks", toolsGuidance: "framework-tools" })) } }));
  await current.projectHost({ ...current.request, onboarding: nativeContext });
  expect(current.assemble.mock.calls[0]?.[0].fills).toEqual({ invoke: "/aidlc", slots: {} });
  expect(current.project.mock.calls[0]?.[0].surface.onboarding.harnessSkeleton)
    .toBe("- **Hook permissions**: Framework hooks run through the self-contained `aidlc` binary. No separate script runtime or executable bits are required.TypeScript sources invoked through the self-contained `aidlc` runtime");
});

test("copy and native callers bind separately from the same immutable captured Tools source", async () => {
  const current = fixture();
  const snapshot = { ...captured, surface: { ...captured.surface, onboarding: accept(admitOnboardingSource({
    neutral: "Neutral", harnessSkeleton: "({{SLOT:framework_tools_runtime}})\r\n",
    hookGuidance: "legacy-authored" as const, toolsGuidance: "framework-tools" as const })) } };
  current.capture.mockResolvedValue(accepted(snapshot));
  await current.projectHost({ ...current.request, onboarding: { channel: "copy" } });
  await current.projectHost({ ...current.request, onboarding: nativeContext });
  expect(current.project.mock.calls[0]?.[0].surface.onboarding.harnessSkeleton).toBe("(TypeScript, run via bun)\r\n");
  expect(current.project.mock.calls[1]?.[0].surface.onboarding.harnessSkeleton)
    .toBe("(TypeScript sources invoked through the self-contained `aidlc` runtime)\r\n");
  expect(snapshot.surface.onboarding.harnessSkeleton).toBe("({{SLOT:framework_tools_runtime}})\r\n");
});

test("the actual first caller binds admitted protocol meaning before hosted interpolation", async () => {
  const current = fixture();
  const documents = accept(admitCwdDocuments({ documents: [{ source: source("protocol.md"), role: "protocol",
    content: { kind: "text", text: "{{SLOT:framework_cwd_guidance}}\r\n{{HARNESS_DIR}}\r\n" } }],
    guidance: { kind: "framework-cwd", source: "protocol.md" } }));
  current.capture.mockResolvedValue(accepted({ ...captured, surface: { ...captured.surface, documents } }));
  await current.projectHost({ ...current.request, onboarding: nativeContext });
  const expectedDocument = { source: source("protocol.md"), role: "protocol", content: {
    kind: "text", text: "**CWD drift warning**: Native release commands resolve `aidlc` from `PATH`, so changing directories does not change the engine path. Keep project-relative file arguments anchored to the project root, or run `cd` commands in subshells: `(cd subdir && npm install)`.\r\n{{HARNESS_DIR}}\r\n" } };
  expect(current.project.mock.calls[0]?.[0].surface.documents).toEqual<unknown>([{ ...expectedDocument,
    nativeDialect: { host: member.host, commands: nativeCommands, permissions: PERMISSION_POLICIES_FIXTURE["prefix-only"],
      replacements: [], captured: expectedDocument } }]);
  expect(documents.documents[0]?.content).toEqual({ kind: "text", text: "{{SLOT:framework_cwd_guidance}}\r\n{{HARNESS_DIR}}\r\n" });
  expect(current.assemble.mock.calls[0]?.[0].fills).toEqual({ invoke: "/aidlc", slots: {} });
});

test("an unknown Projection member refuses before compilation or capture", async () => {
  const current = fixture([]);
  expect(await current.projectHost(current.request)).toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
  expect(current.compile).not.toHaveBeenCalled();
  expect(current.capture).not.toHaveBeenCalled();
  expect(current.assemble).not.toHaveBeenCalled();
});

test("the first missing placement beats compilation and every downstream capability", async () => {
  const current = fixture([{ ...member, projection: { ...member.projection,
    placements: [{ source: "first.md", destination: ".scratch/first.md" },
      { source: "second.md", destination: ".scratch/second.md" }] } }]);
  expect(await current.projectHost(current.request)).toEqual(refused([{ kind: "render-failed", concept: "host-data",
    name: "first.md", reason: "The declared authored host file was not captured." }]));
  expect(current.compile).not.toHaveBeenCalled();
  expect(current.capture).not.toHaveBeenCalled();
  expect(current.assemble).not.toHaveBeenCalled();
});

test("a typed compiler refusal prevents full capture and assembly", async () => {
  const current = fixture();
  current.compile.mockReturnValue(refused({ kind: "invalid-path", base: "project", raw: "../memory" }));
  expect(await current.projectHost(current.request)).toEqual(refused([
    { kind: "invalid-path", base: "project", raw: "../memory" },
  ]));
  expect(current.capture).not.toHaveBeenCalled();
  expect(current.assemble).not.toHaveBeenCalled();
});

test("full capture refusal retains identity and prevents assembly", async () => {
  const current = fixture();
  const failure = refused([{ kind: "neutral-source-unreadable" as const,
    source: source("templates/onboarding.md"), reason: "permission-denied" }]);
  current.capture.mockResolvedValue(failure);
  expect(await current.projectHost(current.request)).toBe(failure);
  expect(current.assemble).not.toHaveBeenCalled();
  expect(current.hosted).not.toHaveBeenCalled();
});

test("assembly refusal retains identity and prevents hosted projection", async () => {
  const current = fixture();
  const failure = refused([{ kind: "render-failed" as const, concept: "host-data" as const,
    name: "assembly", reason: "exact assembly failure" }]);
  current.assemble.mockResolvedValue(failure);
  expect(await current.projectHost(current.request)).toBe(failure);
  expect(current.hosted).not.toHaveBeenCalled();
  expect(current.project).not.toHaveBeenCalled();
});

test("hosted projection refusal retains its exact domain result", async () => {
  const current = fixture();
  const failure = refused([{ kind: "render-failed" as const, concept: "settings" as const,
    name: "settings.json", reason: "exact projection failure" }]);
  current.project.mockResolvedValue(failure);
  expect(await current.projectHost(current.request)).toBe(failure);
});

test("assembly receives Projection-owned renderer mapping and every host heading before filtered hosted projection", async () => {
  const current = fixture();
  expect(await current.projectHost(current.request)).toBe(completion);
  expect(current.compile).toHaveBeenCalledWith({ name: "scratch", directory: ".scratch",
    memoryRoot: "aidlc/spaces/default/memory" });
  expect(current.capture).toHaveBeenCalledWith(current.request.core);
  expect(current.assemble).toHaveBeenCalledWith({ method: methodSliceFixture, sources: [], host: SCRATCH_HOST,
    renderers: { agents: scratchAgentRenderer, skills: scratchSkillRenderer, settings: scratchSettingsRenderer,
      documents: scratchDocumentRenderer, data: renderData, record: commonHarnessRecord, placements: member.projection.placements,
      commandPlacement: scratchCommandPlacement },
    files: [requiredFile, unusedFile], prepare: accepted, tokens, channel: "copy", modelCap: "balanced", tierFlavor: "claude",
    entrypoints: [source("tools/aidlc.ts")], fills: { invoke: "/aidlc", slots: {} }, bindingHeadings: ["Scratch", "Other"],
    projectRoot: new URL("file:///project/"), reviewerAgents: new Set([agent("reviewer")]), runtime: captured.runtime, compiled });
  expect(current.hosted).toHaveBeenCalledWith({ host: SCRATCH_HOST, harness });
  expect(current.project).toHaveBeenCalledWith({ harness: SCRATCH_HOST.distribution, method: methodSliceFixture,
    sources: [], surface: { ...captured.surface, documents: captured.surface.documents.documents }, runtime: captured.runtime, compiled, companions: [], hostFiles: [requiredFile] });
  expect(current.compile.mock.invocationCallOrder[0]).toBeLessThan(current.capture.mock.invocationCallOrder[0] ?? -1);
  expect(current.capture.mock.invocationCallOrder[0]).toBeLessThan(current.assemble.mock.invocationCallOrder[0] ?? -1);
  expect(current.assemble.mock.invocationCallOrder[0]).toBeLessThan(current.hosted.mock.invocationCallOrder[0] ?? -1);
});

test("an optional host deriver remains the exact assembly capability", async () => {
  const derive = mock<HostFileDeriver>().mockResolvedValue(accepted([]));
  const current = fixture([{ ...member, projection: { ...member.projection, derive } }]);
  expect(await current.projectHost(current.request)).toBe(completion);
  expect(current.assemble).toHaveBeenCalledWith(expect.objectContaining({ renderers: expect.objectContaining({ derive }) }));
  expect(derive).not.toHaveBeenCalled();
});

test("Projection requests the channel's fills once after admission and forwards the exact authored value", async () => {
  const fills = { invoke: "custom", slots: { ["prereq_bullets"]: "Opaque custom prerequisite" } };
  const readFills = mock<HostProjectionMember["projection"]["fills"]>().mockReturnValue(fills);
  const current = fixture([{ ...member, projection: { ...member.projection, fills: readFills } }]);
  expect(await current.projectHost({ ...current.request, onboarding: nativeContext })).toBe(completion);
  expect(readFills).toHaveBeenCalledWith(nativeContext);
  expect(readFills).toHaveBeenCalledTimes(1);
  expect(current.assemble.mock.calls[0]?.[0].fills).toBe(fills);
});

test("a full-capture refusal does not request channel fills or start serialization", async () => {
  const readFills = mock<HostProjectionMember["projection"]["fills"]>();
  const current = fixture([{ ...member, projection: { ...member.projection, fills: readFills } }]);
  const failure = refused([{ kind: "render-failed" as const, concept: "host-data" as const,
    name: "capture", reason: "controlled capture refusal" }]);
  current.capture.mockResolvedValue(failure);
  expect(await current.projectHost(current.request)).toBe(failure);
  expect(readFills).not.toHaveBeenCalled();
  expect(current.assemble).not.toHaveBeenCalled();
});
