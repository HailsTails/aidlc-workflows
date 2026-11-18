import { commonHarnessRecord } from "./domain/harness-record.ts";
import type { HostDataRenderer } from "./application/ports/host-surface.ts";
import { agent } from "../workflow-definition/fixtures/identities.fixture.ts";
import { methodSource } from "../workflow-definition/fixtures/method-source.fixture.ts";
import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { accepted, refused } from "../kernel/result.ts";
import { tokenBindingsFixture } from "./fixtures/token-bindings.fixture.ts";
import type { AgentDocumentRenderer, HostAgentRenderer } from "./application/ports/agents.ts";
import type { CoreAgent } from "../workflow-definition/domain/agent.ts";
import type { HostSettingsRenderer } from "./application/ports/settings.ts";
import { createBuildProjection as createProjection } from "./core-root.ts";
import { createRecordingPluginProjector } from "./fixtures/plugin-projector.fake.ts";
import { extendedSubprocessTimeoutMs } from "./adapters/legacy-runtime-budget.ts";
import { accept } from "../kernel/fixtures/accept.ts";
import { SCRATCH_HOST, SCRATCH_HOST_DATA, scratchAgentRenderer, scratchCommandPlacement,
  scratchSkillRenderer, scratchSettingsRenderer, scratchDocumentRenderer } from "./fixtures/scratch-host.fixture.ts";


const identity = host({ name: "claude", directory: ".claude" });
const createBuildProjection = (request: Omit<Parameters<typeof createProjection>[0], "plugins">) =>
  createProjection({ ...request, plugins: createRecordingPluginProjector() });

const documentAgent: CoreAgent = {
  slug: agent("aidlc-example-agent"), source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
  displayName: "Example", description: "Role", examples: [], owner: { kind: "core" },
  model: { kind: "tier", tier: "balanced" }, tools: { disallowed: [] }, maxTurns: null,
  persona: { text: "No fallback", headings: [] }, additions: { afterPreflight: [], endOfBody: [] },
};

test("the production root binds a private captured frame and drains it before returning a derivation refusal", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const writeFile = mock(scratch.writeFile);
  const projection = createBuildProjection({ hostFiles: scratch, sessionFiles: scratch,
    runnerScratch: { ...scratch, writeFile },
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "No child" }) }),
    runnerFrames: new URL("file:///C:/q179-root/frames/"), runnerChild: new URL("file:///C:/q179-root/child.ts") });
  const failure = refused({ kind: "render-failed" as const, concept: "onboarding" as const,
    name: "derived", reason: "Exact causal refusal" });
  const render = mock(() => failure);
  const harness = accept(await projection.assembleHarness({ host: SCRATCH_HOST,
    method: { ...methodSliceFixture, stages: [], scopes: [], agents: [] }, sources: [], files: [],
    prepare: accepted, channel: "copy", modelCap: null, tierFlavor: "claude", entrypoints: [],
    tokens: tokenBindingsFixture({ harnessDir: ".scratch" }), fills: { invoke: "/aidlc", slots: {} },
    bindingHeadings: [], projectRoot: new URL("file:///project/"), reviewerAgents: new Set(),
    runtime: { files: [], version: { kind: "text", text: "Version" }, agentTiers: { kind: "text", text: "{}" },
      settingsSchema: { kind: "text", text: "{}" } }, compiled: { graph: "[]", grid: "{}" },
    renderers: { agents: scratchAgentRenderer, skills: scratchSkillRenderer, settings: scratchSettingsRenderer,
      documents: scratchDocumentRenderer, data: () => SCRATCH_HOST_DATA, record: commonHarnessRecord,
      placements: [], commandPlacement: scratchCommandPlacement,
      derive: ({ frame, files }) => frame.render({ files, render }),
    },
  }));
  const file = { path: path("aidlc/spaces/default/memory/org.md"), content: {
    kind: "text" as const, text: "Captured memory" }, mode: "regular" as const, origin: { kind: "active-space" as const } };
  writeFile.mockClear();
  expect(await harness.deriveFiles({ files: [file] })).toBe(failure);
  expect(writeFile).toHaveBeenCalledTimes(1);
  expect(writeFile.mock.calls[0]?.[0].file.href)
    .toMatch(/^file:\/\/\/C:\/q179-root\/frames\/scratch-\d+\/aidlc\/spaces\/default\/memory\/org.md$/);
  expect(writeFile.mock.calls[0]?.[0].content).toEqual(file.content);
  expect(render).toHaveBeenCalledTimes(1);
  expect(scratch.snapshot()).toEqual({});
});

test("root preparation sends captured facts to the host renderer and preserves its exact refusal", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostAgentRenderer>(() => ({ renderAgent: () => accepted([]),
    renderConductorAgent: () => accepted([]) }));
  expect(projection.projectAgents({ rulesFolder: null, method: methodSliceFixture,
    host: host({ name: "unknown", directory: ".unknown" }), render, files: [], prepare: accepted,
    channel: "copy", modelCap: "templated", tierFlavor: "claude", reviewerAgents: new Set(),
    tokens: tokenBindingsFixture({ harnessDir: ".unknown" }), sources: [{ owner: { kind: "core" },
      path: documentAgent.source, content: { kind: "text", text: "\uFEFF---\nname: Example\n---\nPersona\n" } }],
  })).toEqual(accepted([]));
  const rendererFailure = refused({ kind: "render-failed" as const, concept: "agent" as const,
    name: documentAgent.slug, reason: "Host-owned refusal." });
  const formatter = mock<AgentDocumentRenderer>().mockReturnValueOnce(accepted("Host-owned output"))
    .mockReturnValueOnce(rendererFailure);
  const documentRequest = { agent: documentAgent, text: "authored-file", knowledge: "absorbed",
    reading: { kind: "whole-files" }, model: "omitted", render: formatter } as const;
  const agentInputs = render.mock.calls[0]?.[0];
  expect(agentInputs?.documents(documentRequest)).toEqual(accepted("Host-owned output"));
  expect(formatter).toHaveBeenNthCalledWith(1, { agent: documentAgent.slug,
    content: "---\nname: Example\n---\n<!-- aidlc-delegated-knowledge-preflight -->\n" +
      "**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.unknown/knowledge/aidlc-shared/` (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it), `.unknown/knowledge/aidlc-example-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/aidlc-example-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.\n\nPersona\n",
    model: {} });
  expect(agentInputs?.documents(documentRequest)).toBe(rendererFailure);
  expect(formatter).toHaveBeenCalledTimes(2);
});

test("Projection composes host capture and graph serialization through its own adapters", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { "file:///host/SKILL.md": "raw" } });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(await projection.readHostSources({ host: identity, root: new URL("file:///host/"),
    sources: [source("SKILL.md")], required: [] })).toEqual(accepted([{
      source: source("SKILL.md"), content: { kind: "bytes", bytes: new Uint8Array([114, 97, 119]) },
    }]));
  expect(JSON.parse(projection.serializeMethod({ method: methodSliceFixture, host: identity,
    memoryRoot: path("aidlc/spaces/default/memory") }).graph)[0]).toMatchObject({
    slug: "requirements-analysis", number: "2.3",
  });
});

test("Projection composition serves the shared delegate facts to a native data renderer", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(projection.projectHostSurface({ record: commonHarnessRecord, host: identity, files: [], placements: [], prepare: accepted,
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), channel: "copy",
    renderData: ({ delegateShellFacts }) => ({ productName: "Policy fixture", configNextStep: "Open", rulesFolder: null,
      pluginAgentFrontmatter: { copy: [delegateShellFacts.engineNamespace], native: [] } }),
  })).toEqual(accepted([
    { path: path(".claude/tools/data/harness.json"), content: { kind: "text", text: `{
  "schemaVersion": 1,
  "distribution": "claude",
  "productName": "Policy fixture",
  "configNextStep": "Open",
  "name": "claude",
  "harnessDir": ".claude",
  "rulesSubdir": "rules"
}
` }, mode: "regular",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
    { path: path(".claude/tools/data/plugin-agent.md"),
      content: { kind: "text", text: "---\nengine\n---\n" },
      mode: "regular",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
  ]));
});

test("settings composition supplies captured timeout, trust identity and capped CLI policy", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostSettingsRenderer>(() => ({ renderSettings: () => accepted([]),
    renderHookRegistrations: () => accepted([]) }));
  expect(projection.projectSettings({ method: methodSliceFixture, host: identity, render,
    files: [], prepare: accepted, tokens: tokenBindingsFixture({ harnessDir: ".claude" }),
    channel: "copy", entrypoints: [], modelCap: "templated" })).toEqual(accepted([]));
  expect(render).toHaveBeenCalledTimes(1);
  const inputs = render.mock.calls[0]?.[0];
  expect(inputs?.nativeCommands).toBe(projection.nativeCommands);
  expect(projection.delegateShellFacts.trustedCommand).toBe(projection.nativeCommands.trusted);
  expect(inputs?.extendedSubprocessTimeoutMs).toBe(1_800_000);
  expect(inputs).not.toHaveProperty("hookTrust");
  expect(inputs?.cliModels({ source: source("settings/cli.json"), content: { kind: "text", text: "{}" } }))
    .toEqual(accepted({ source: source("settings/cli.json"), content: { kind: "text", text: "{}\n" } }));
});

test("agent composition supplies shipped allows to one native factory for the complete Method", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostAgentRenderer>(() => ({ renderAgent: () => accepted([]),
    renderConductorAgent: () => accepted([]) }));
  expect(projection.projectAgents({ rulesFolder: null, method: methodSliceFixture, host: identity, render, files: [],
    prepare: accepted, channel: "copy", modelCap: null, tierFlavor: "claude", sources: [], reviewerAgents: new Set(),
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }) })).toEqual(accepted([]));
  expect(render).toHaveBeenCalledTimes(1);
  expect(render.mock.calls[0]?.[0].allows.dispatcherCommands).toContain("doctor");
  expect(render.mock.calls[0]?.[0].allows.toolScripts).toContain("aidlc-graph.ts");
  expect(render.mock.calls[0]?.[0].delegateShellFacts.trustedCommand).toBe(projection.nativeCommands.trusted);
  expect(render.mock.calls[0]?.[0].delegateShellFacts).toBe(projection.delegateShellFacts);
});

test("agent composition exposes a missing captured source refusal without reconstructing Markdown", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostAgentRenderer>(() => ({ renderAgent: () => accepted([]), renderConductorAgent: () => accepted([]) }));
  expect(projection.projectAgents({ rulesFolder: null, method: methodSliceFixture, host: identity, render, files: [], prepare: accepted,
    channel: "copy", modelCap: null, tierFlavor: "claude", sources: [], reviewerAgents: new Set(), tokens: tokenBindingsFixture({ harnessDir: ".claude" }) }))
    .toEqual(accepted([]));
  expect(render.mock.calls[0]?.[0].documents({ agent: {
    slug: agent("aidlc-example-agent"), source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
    displayName: "Example", description: "Role", examples: [], owner: { kind: "core" }, model: { kind: "tier", tier: "balanced" },
    tools: { disallowed: [] }, maxTurns: null, persona: { text: "No fallback", headings: [] },
    additions: { afterPreflight: [], endOfBody: [] },
  }, text: "authored-file", knowledge: "absorbed", reading: { kind: "whole-files" },
    model: "projected", render: ({ content }) => accepted(content) }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "agent", name: "aidlc-example-agent",
      reason: "The accepted agent's authored source was not captured." } });
});

test("agent composition absorbs knowledge for a core agent appointed only by the supplied combined reviewer set", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostAgentRenderer>(() => ({ renderAgent: () => accepted([]), renderConductorAgent: () => accepted([]) }));
  expect(projection.projectAgents({ rulesFolder: null, method: methodSliceFixture, host: identity, render, files: [], prepare: accepted,
    channel: "copy", modelCap: null, tierFlavor: "claude", reviewerAgents: new Set([agent("aidlc-product-agent")]),
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), sources: [
      { owner: { kind: "core" }, path: methodSource({ kind: "agent", within: "aidlc-product-agent.md" }),
        content: { kind: "text", text: "<!-- aidlc-delegated-knowledge-preflight -->\nPersona\n" } },
      { owner: { kind: "core" }, path: methodSource({ kind: "knowledge", within: "aidlc-product-agent/check.md" }),
        content: { kind: "text", text: "Plugin reviewer knowledge\n" } },
    ] })).toEqual(accepted([]));
  expect(render.mock.calls[0]?.[0].persona({ agent: {
    slug: agent("aidlc-product-agent"), source: methodSource({ kind: "agent", within: "aidlc-product-agent.md" }),
    displayName: "Product Agent", description: "Role", examples: [], owner: { kind: "core" }, model: { kind: "tier", tier: "judgment" },
    tools: { disallowed: [] }, maxTurns: null, persona: { text: "No fallback", headings: [] },
    additions: { afterPreflight: [], endOfBody: [] },
  }, text: "authored-file", knowledge: "absorbed", reading: { kind: "whole-files" } }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\nPersona\n\n---\n\n<!-- Absorbed at build time from knowledge/aidlc-product-agent/check.md - edit that file, not this generated copy. -->\n\nPlugin reviewer knowledge\n"));
});

test("Projection exposes the exact facts instance its native data route receives", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const renderData = mock<HostDataRenderer>(() => ({ productName: "Facts", configNextStep: "Open", rulesFolder: null }));
  projection.projectHostSurface({ record: commonHarnessRecord, host: identity, files: [], placements: [], prepare: accepted,
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), channel: "copy", renderData });
  expect(renderData).toHaveBeenCalledTimes(1);
  expect(renderData.mock.calls[0]?.[0]?.delegateShellFacts).toBe(projection.delegateShellFacts);
});

test("Projection binds the settings capabilities once for every renderer and caller", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(projection.settingsCapabilities).toEqual({
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(),
  });
});


test("Projection serves native route facts from the existing dispatcher and command owners", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  expect(projection.nativeCommands.trusted("stage status")).toBe("aidlc engine stage status");
  expect(projection.nativeCommands.delegates).toContain("utility");
  expect(projection.nativeCommands.adapterHooks.has("kiro-adapter")).toBe(true);
  expect(projection.nativeCommands.unresolvable({ file: "guide.md", text: "aidlc engine imaginary route" }))
    .toEqual(['guide.md:1: unresolvable projected namespace invocation "aidlc engine imaginary route"']);
});
