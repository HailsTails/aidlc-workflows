import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { path, source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { claudeProjectionFixture } from "../fixtures/claude-projection.fixture.ts";
import { codexProjectionFixture } from "../fixtures/codex-projection.fixture.ts";
import { tokenBindingsFixture } from "../fixtures/token-bindings.fixture.ts";
import type { Harness, HarnessRegistry, HostedHarness, Rendering } from "./ports.ts";
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
});
const request: ProjectMethodRequest = {
  harness: claudeProjectionFixture.host.distribution, method: methodSliceFixture,
  sources: [], hostFiles: [], surface: { documents: [], skills: [], onboarding: { neutral: "N", harnessSkeleton: "H" } },
  runtime: { files: [], version: { kind: "text", text: "version" },
    agentTiers: { kind: "text", text: "tiers" }, settingsSchema: { kind: "text", text: "schema" } },
};
const claudeRuntime = [
  { path: path(".claude/tools/aidlc-version.ts"), content: { kind: "text", text: "version" },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("tools/aidlc-version.ts") } },
  { path: path(".claude/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
  { path: path(".claude/tools/data/settings-schema.json"), content: { kind: "text", text: "schema" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
] as const;
const codexRuntime = [
  { path: path(".codex/tools/aidlc-version.ts"), content: { kind: "text", text: "version" },
    mode: "regular", availability: "always", origin: { kind: "neutral", source: source("tools/aidlc-version.ts") } },
  { path: path(".codex/tools/data/agent-tiers.json"), content: { kind: "text", text: "tiers" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "agent-tiers" } },
  { path: path(".codex/tools/data/settings-schema.json"), content: { kind: "text", text: "schema" },
    mode: "regular", availability: "always", origin: { kind: "runtime-data", name: "settings-schema" } },
] as const;

const registry = (hosted: HostedHarness): HarnessRegistry => ({
  find: () => accepted(hosted), all: () => [hosted],
});

test("a full fixture Harness reproduces every Claude projection byte and provenance plus shared runtime", () => {
  const harness = claudeHarness();
  const project = createProjectMethodForHarness(registry({ host: claudeProjectionFixture.host, harness }));
  const projection = project.project({ ...request, sources: [
    { owner: { kind: "core" }, path: methodSource({ kind: "agent", within: "aidlc-developer-agent.md" }),
      content: rawAgent.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "stage", within: "construction/code-generation.md" }),
      content: rawStage.content },
    { owner: { kind: "core" }, path: methodSource({ kind: "knowledge",
      within: "aidlc-developer-agent/code-generation-guide.md" }), content: rawKnowledge.content },
  ], hostFiles: [{ source: source("harness/claude/dot-gitignore"), content: claudeAuthored.content }] });
  expect(projection).toEqual(accepted({ ...claudeProjectionFixture, files: expect.arrayContaining([
      ...claudeProjectionFixture.files, ...claudeRuntime,
    ]) }));
  expect(projection).toHaveProperty("value.files.length", 12);
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
  expect(projection).toHaveProperty("value.files.length", 10);
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
      { kind: "neutral", source: source("tools/aidlc-version.ts") },
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

test("neutral inputs bind before native placement and final renderer bytes receive no second pass", () => {
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
    content: { kind: "text", text: ".claude|bun .claude/tools/aidlc.ts" },
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
