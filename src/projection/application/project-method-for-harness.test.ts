import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { claudeProjectionFixture } from "../fixtures/claude-projection.fixture.ts";
import { codexProjectionFixture } from "../fixtures/codex-projection.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import type { Harness, HarnessRegistry, HostedHarness, Rendering } from "./ports/harness.ts";
import type { ProjectMethodRequest } from "./use-cases.ts";
import { createProjectMethodForHarness } from "./project-method-for-harness.ts";

const [claudeAgent, rawAgent, claudeStage, claudeScope, rawStage, rawKnowledge,
  claudeHooks, claudeOnboarding, claudeAuthored] = claudeProjectionFixture.files;
const [codexAgent, codexStage, codexDoor, codexAuthored, codexHooks, codexGuide, codexSetup]
  = codexProjectionFixture.files;


const claudeHarness = (): Harness => ({
  tokens: tokenBindingsFixture({ harnessDir: ".claude" }),
  renderAgent: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([claudeAgent])),
  renderConductorAgent: mock(() => accepted([])),
  renderStageCommand: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([claudeStage])),
  renderScopeCommand: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([claudeScope])),
  renderSessionSkill: mock(() => accepted([])), renderOrchestratorSkill: mock(() => accepted([])),
  renderSettings: mock(() => accepted([])), renderHookRegistrations: mock(() => accepted([claudeHooks])),
  renderOnboarding: mock(() => accepted([claudeOnboarding])), renderHostData: mock(() => accepted([])),
  placeNeutralDocument: mock(() => accepted([])), placeAuthoredFile: mock(() => accepted([claudeAuthored])),
  deriveFiles: mock(() => accepted([])),
});
const codexHarness = (): Harness => ({
  tokens: tokenBindingsFixture({ harnessDir: ".codex" }),
  renderAgent: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([codexAgent])),
  renderConductorAgent: mock(() => accepted([])),
  renderStageCommand: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([codexStage])),
  renderScopeCommand: mock(() => accepted([])), renderSessionSkill: mock(() => accepted([])),
  renderOrchestratorSkill: mock(() => accepted([codexDoor])), renderSettings: mock(() => accepted([])),
  renderHookRegistrations: mock(() => accepted([codexHooks])),
  renderOnboarding: mock(() => accepted([codexGuide, codexSetup])), renderHostData: mock(() => accepted([])),
  placeNeutralDocument: mock(() => accepted([])), placeAuthoredFile: mock(() => accepted([codexAuthored])),
  deriveFiles: mock(() => accepted([])),
});
const request: ProjectMethodRequest = {
  harness: claudeProjectionFixture.host.distribution, method: methodSliceFixture,
  compiled: { graph: "graph", grid: "grid" },
  sources: [], companions: [], hostFiles: [], surface: { documents: [], skills: [], onboarding: { neutral: "N", harnessSkeleton: "H" } },
  runtime: { files: [], version: { kind: "text", text: "version" },
    agentTiers: { kind: "text", text: "tiers" }, settingsSchema: { kind: "text", text: "schema" } },
};
const claudeRuntime = [
  { path: path(".claude/tools/aidlc-version.ts"), content: { kind: "text", text: "version" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "version-module" } },
  { path: path(".claude/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
  { path: path(".claude/tools/data/aidlc-settings.schema.json"), content: { kind: "text", text: "schema" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
  { path: path(".claude/tools/data/stage-graph.json"), content: { kind: "text", text: "graph" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "stage-graph" } },
  { path: path(".claude/tools/data/scope-grid.json"), content: { kind: "text", text: "grid" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "scope-grid" } },
  { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
    mode: "regular", availability: "always", origin: { kind: "active-space" } },
] as const;
const codexRuntime = [
  { path: path(".codex/tools/aidlc-version.ts"), content: { kind: "text", text: "version" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "version-module" } },
  { path: path(".codex/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
  { path: path(".codex/tools/data/aidlc-settings.schema.json"), content: { kind: "text", text: "schema" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
  { path: path(".codex/tools/data/stage-graph.json"), content: { kind: "text", text: "graph" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "stage-graph" } },
  { path: path(".codex/tools/data/scope-grid.json"), content: { kind: "text", text: "grid" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "scope-grid" } },
  { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
    mode: "regular", availability: "always", origin: { kind: "active-space" } },
] as const;

const registry = (hosted: HostedHarness): HarnessRegistry => ({
  find: () => accepted(hosted), all: () => [hosted],
});

test("a full fixture Harness reproduces every Claude projection byte and provenance plus shared runtime", () => {
  const harness = { ...claudeHarness(), placeNeutralDocument: mock((): Rendering => accepted([]))
    .mockReturnValueOnce(accepted([rawStage])).mockReturnValueOnce(accepted([rawKnowledge])) };
  const project = createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host, harness }));
  const projection = project.project({ ...request, sources: [
    { owner: { kind: "core" }, path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }),
      content: rawAgent.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "stage", within: "construction/code-generation.md" }),
      content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "knowledge",
      within: "aidlc-developer-agent/code-generation-guide.md" }), content: rawKnowledge.content },
  ], surface: { ...request.surface, documents: [
    { source: source("aidlc-common/stages/construction/code-generation.md"), role: "stage", content: rawStage.content },
    { source: source("knowledge/aidlc-developer-agent/code-generation-guide.md"), role: "knowledge",
      content: rawKnowledge.content },
  ] }, hostFiles: [{ source: source("harness/claude/dot-gitignore"), content: claudeAuthored.content }] });
  expect(projection).toEqual(accepted({ ...claudeProjectionFixture, files: expect.arrayContaining([
      claudeAgent, claudeStage, claudeScope, rawStage, rawKnowledge,
      claudeHooks, claudeOnboarding, claudeAuthored, ...claudeRuntime,
    ]) }));
  expect(projection).toHaveProperty("value.files.length", 14);
  expect(harness.renderAgent).toHaveBeenCalledTimes(6);
  expect(harness.renderConductorAgent).toHaveBeenCalledTimes(1);
  expect(harness.renderSettings).toHaveBeenCalledWith({ method: methodSliceFixture });
  expect(harness.renderHookRegistrations).toHaveBeenCalledWith({ hooks: methodSliceFixture.hooks });
  expect(harness.renderHostData).toHaveBeenCalledTimes(1);
});

test("a full fixture Harness reproduces Codex's split native paths and every fixture file", () => {
  const harness = codexHarness();
  const project = createProjectMethodForHarness(registry({ host: codexProjectionFixture.host, harness }));
  const projection = project.project({ ...request, harness: codexProjectionFixture.host.distribution,
    hostFiles: [{ source: source("harness/codex/rules-aidlc.md"), content: codexAuthored.content }] });
  expect(projection).toEqual(accepted({ ...codexProjectionFixture, files: expect.arrayContaining([
      ...codexProjectionFixture.files, ...codexRuntime,
    ]) }));
  expect(projection).toHaveProperty("value.files.length", 13);
  expect(harness.renderOrchestratorSkill).toHaveBeenCalledWith({ method: methodSliceFixture });
  expect(harness.renderOnboarding).toHaveBeenCalledWith({ templates: { neutral: "N", harnessSkeleton: "H" },
    method: methodSliceFixture });
});

test("unknown harness selection is a refusal before any rendering", () => {
  expect(createProjectMethodForHarness({ find: () => refused({ kind: "unknown-harness", harness: "missing" }),
    all: () => [] }).project(request)).toEqual(refused([{ kind: "unknown-harness", harness: "missing" }]));
});

test("expected renderer failures are all retained in rendered-concept order", () => {
  expect(createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host, harness: {
    ...claudeHarness(), renderSettings: () => refused({ kind: "render-failed", concept: "settings",
      name: "settings.json", reason: "Missing settings" }),
    renderHookRegistrations: () => refused({ kind: "render-failed", concept: "hook-registration",
      name: "native-hooks", reason: "Missing hooks" }),
  } })).project(request)).toEqual(refused([
    { kind: "render-failed", concept: "settings", name: "settings.json", reason: "Missing settings" },
    { kind: "render-failed", concept: "hook-registration", name: "native-hooks", reason: "Missing hooks" },
  ]));
});

test("all concepts use the existing final-path collision owner", () => {
  expect(createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host, harness: {
    ...claudeHarness(), renderSettings: () => accepted([{
      path: path(".claude/tools/aidlc-version.ts"), content: { kind: "text", text: "other" },
      mode: "regular", availability: "always", origin: { kind: "rendered", concept: "settings", name: "settings" },
    }]),
  } })).project(request)).toEqual(refused([{ kind: "path-collision",
    path: path(".claude/tools/aidlc-version.ts"), origins: [
      { kind: "rendered", concept: "settings", name: "settings" },
      { kind: "runtime-data", name: "version-module" },
    ],
  }]));
});

test("runtime owns a copied path that is also represented in the semantic source snapshot", () => {
  expect(createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host,
    harness: claudeHarness() })).project({ ...request, sources: [{ owner: { kind: "core" },
      path: methodSource({ kind: "scope", within: "feature.md" }),
      content: { kind: "text", text: "semantic snapshot" } }], runtime: { ...request.runtime,
      files: [{ source: source("scopes/feature.md"), content: { kind: "text", text: "copy snapshot" } }],
    } })).toHaveProperty("value.files", expect.arrayContaining([{
      path: path(".claude/scopes/feature.md"), content: { kind: "text", text: "copy snapshot" },
      mode: "regular", availability: "always", origin: { kind: "neutral", source: source("scopes/feature.md") },
    }]));
});

test("neutral documents reach the native owner raw and final bytes receive no second pass", () => {
  const placeNeutralDocument = mock((): Rendering => accepted([{
    path: path(".claude/protocol.md"), content: { kind: "text", text: "literal {{INVOKE}}" },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("protocol.md") },
  }]));
  const projection = createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host,
    harness: { ...claudeHarness(), placeNeutralDocument } })).project({ ...request, surface: {
      ...request.surface, documents: [{ source: source("protocol.md"), role: "protocol",
        content: { kind: "text", text: "{{HARNESS_DIR}}|{{INVOKE}}" } }],
    } });
  expect(placeNeutralDocument).toHaveBeenCalledTimes(1);
  expect(placeNeutralDocument).toHaveBeenCalledWith({ document: {
    source: source("protocol.md"), role: "protocol",
    content: { kind: "text", text: "{{HARNESS_DIR}}|{{INVOKE}}" },
  } });
  expect(projection).toHaveProperty("value.files", expect.arrayContaining([{
    path: path(".claude/protocol.md"), content: { kind: "text", text: "literal {{INVOKE}}" },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("protocol.md") },
  }]));
});

test("session skills precede the orchestrator and settings in rendered-concept order", () => {
  const projection = createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host,
    harness: { ...claudeHarness(), renderSessionSkill: () => accepted([{
      path: path(".claude/session.md"), content: { kind: "text", text: "session" },
      mode: "regular", availability: "always", origin: { kind: "rendered", concept: "session-skill", name: "session" },
    }]), renderOrchestratorSkill: () => accepted([{
      path: path(".claude/door.md"), content: { kind: "text", text: "door" },
      mode: "regular", availability: "always", origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc" },
    }]), renderSettings: () => accepted([{
      path: path(".claude/settings-native.json"), content: { kind: "text", text: "settings" },
      mode: "regular", availability: "always", origin: { kind: "rendered", concept: "settings", name: "settings" },
    }]) } })).project({ ...request, surface: { ...request.surface, skills: [{ name: "session", files: [] }] } });
  expect(projection).toHaveProperty("value.files.3.path", path(".claude/session.md"));
  expect(projection).toHaveProperty("value.files.4.path", path(".claude/door.md"));
  expect(projection).toHaveProperty("value.files.5.path", path(".claude/settings-native.json"));
});

const ownershipRequest = (): ProjectMethodRequest => ({ ...request,
  sources: [
    { owner: { kind: "core" }, path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }),
      content: rawAgent.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "stage", within: "construction/code-generation.md" }),
      content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "knowledge",
      within: "aidlc-developer-agent/code-generation-guide.md" }), content: rawKnowledge.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "feature.md" }), content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "sensor", within: "check.md" }), content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "hook", within: "start.ts" }), content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "rule", within: "org.md" }), content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "overlay", within: "stage.yaml" }), content: rawStage.content },
  ], surface: { ...request.surface, documents: [
    { source: source("aidlc-common/stages/construction/code-generation.md"), role: "stage", content: rawStage.content },
    { source: source("knowledge/aidlc-developer-agent/code-generation-guide.md"), role: "knowledge",
      content: rawKnowledge.content },
  ] }, runtime: { ...request.runtime, files: [
    { source: source("scopes/feature.md"), content: rawStage.content },
    { source: source("sensors/check.md"), content: rawStage.content },
    { source: source("hooks/start.ts"), content: rawStage.content },
  ] },
});

test("every source kind has one placement owner, except the intentional rule twins and folded overlay", () => {
  const harness: Harness = { ...claudeHarness(),
    renderAgent: mock((): Rendering => accepted([])).mockReturnValueOnce(accepted([{
      ...claudeAgent, origin: { kind: "method-source",
        path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }) },
    }])), renderStageCommand: () => accepted([]), renderScopeCommand: () => accepted([]),
    renderHookRegistrations: () => accepted([]), renderOnboarding: () => accepted([]),
    placeNeutralDocument: mock((): Rendering => accepted([]))
      .mockReturnValueOnce(accepted([rawStage])).mockReturnValueOnce(accepted([rawKnowledge])),
  };
  const projection = accept(createProjectMethodForHarness(registry({
    host: claudeProjectionFixture.host, harness,
  })).project(ownershipRequest()));
  expect(projection.files).toEqual(ownershipFiles());
});

const ownershipFiles = (): readonly ProjectedFile[] => [
  { ...claudeAgent, origin: { kind: "method-source",
    path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }) } },
  rawStage, rawKnowledge,
  { path: path("aidlc/spaces/default/memory/org.md"), content: rawStage.content,
    mode: "regular", availability: "always", origin: { kind: "workspace-memory", copy: "space",
      path: methodSource({ kind: "rule", within: "org.md" }) } },
  { path: path(".claude/tools/data/memory-seed/org.md"), content: rawStage.content,
    mode: "regular", availability: "always", origin: { kind: "workspace-memory", copy: "seed",
      path: methodSource({ kind: "rule", within: "org.md" }) } },
  { path: path("aidlc/active-space"), content: { kind: "text", text: "default\n" },
    mode: "regular", availability: "always", origin: { kind: "active-space" } },
  { path: path(".claude/scopes/feature.md"), content: rawStage.content,
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("scopes/feature.md") } },
  { path: path(".claude/sensors/check.md"), content: rawStage.content,
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("sensors/check.md") } },
  { path: path(".claude/hooks/start.ts"), content: rawStage.content,
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("hooks/start.ts") } },
  { path: path(".claude/tools/aidlc-version.ts"), content: { kind: "text", text: "version" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "version-module" } },
  { path: path(".claude/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
  { path: path(".claude/tools/data/aidlc-settings.schema.json"), content: { kind: "text", text: "schema" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
  { path: path(".claude/tools/data/stage-graph.json"), content: { kind: "text", text: "graph" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "stage-graph" } },
  { path: path(".claude/tools/data/scope-grid.json"), content: { kind: "text", text: "grid" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "scope-grid" } },
];
