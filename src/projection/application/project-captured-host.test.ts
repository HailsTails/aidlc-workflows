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
const compiled = { graph: "captured graph", grid: "captured grid" };
const captured: FullHostCapture = { surface: { documents: [], skills: [], onboarding: { neutral: "Neutral", harnessSkeleton: "Host" } },
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
  const project = mock<ProjectMethodForHarness["project"]>().mockReturnValue(completion);
  const hosted = mock<CapturedHostProjectionPorts["hosted"]>().mockReturnValue({ project });
  const request: CapturedHostProjectionRequest = { host: SCRATCH_HOST,
    core: { method: methodSliceFixture, sources: [] }, compile, files: [requiredFile, unusedFile], prepare: accepted,
    tokens, channel: "copy", modelCap: "balanced", entrypoints: [source("tools/aidlc.ts")],
    projectRoot: new URL("file:///project/"), reviewerAgents: new Set([agent("reviewer")]) };
  return { compile, capture, assemble, project, hosted, request,
    projectHost: createProjectCapturedHost({ members, capture, assemble, hosted }) };
};

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
  current.project.mockReturnValue(failure);
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
    sources: [], surface: captured.surface, runtime: captured.runtime, compiled, companions: [], hostFiles: [requiredFile] });
  expect(current.compile.mock.invocationCallOrder[0]).toBeLessThan(current.capture.mock.invocationCallOrder[0] ?? -1);
  expect(current.capture.mock.invocationCallOrder[0]).toBeLessThan(current.assemble.mock.invocationCallOrder[0] ?? -1);
  expect(current.assemble.mock.invocationCallOrder[0]).toBeLessThan(current.hosted.mock.invocationCallOrder[0] ?? -1);
});

test("an optional host deriver remains the exact assembly capability", async () => {
  const derive = mock<Harness["deriveFiles"]>().mockReturnValue(accepted([]));
  const current = fixture([{ ...member, projection: { ...member.projection, derive } }]);
  expect(await current.projectHost(current.request)).toBe(completion);
  expect(current.assemble).toHaveBeenCalledWith(expect.objectContaining({ renderers: expect.objectContaining({ derive }) }));
  expect(derive).not.toHaveBeenCalled();
});

test("Projection requests the channel's fills once after admission and forwards the exact authored value", async () => {
  const fills = { invoke: "custom", slots: { ["prereq_bullets"]: "Opaque custom prerequisite" } };
  const readFills = mock<HostProjectionMember["projection"]["fills"]>().mockReturnValue(fills);
  const current = fixture([{ ...member, projection: { ...member.projection, fills: readFills } }]);
  expect(await current.projectHost({ ...current.request, channel: "native" })).toBe(completion);
  expect(readFills).toHaveBeenCalledWith("native");
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
