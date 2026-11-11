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
import type { HostAgentRenderer } from "./application/ports/agents.ts";
import type { HostSettingsRenderer } from "./application/ports/settings.ts";
import { createBuildProjection } from "./core-root.ts";

const identity = host({ name: "claude", directory: ".claude" });

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
  expect(projection.projectHostSurface({ host: identity, files: [], placements: [], prepare: accepted,
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
` }, mode: "regular", availability: "always",
      origin: { kind: "rendered", concept: "host-data", name: "claude" } },
    { path: path(".claude/tools/data/plugin-agent.md"),
      content: { kind: "text", text: "---\nengine\n---\n" },
      mode: "regular", availability: "always",
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
  expect(inputs?.extendedSubprocessTimeoutMs).toBe(1_800_000);
  expect(inputs?.hookTrust({ event: "session_start", command: "aidlc engine hook session-start",
    timeoutSeconds: 1800, matcher: undefined }))
    .toBe("sha256:2b4117d0e4fefa944da660b81b311dfd50426b70b8612cf9046f1cbcf4c7f163");
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
    prepare: accepted, channel: "copy", modelCap: null, sources: [], reviewerAgents: new Set(),
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }) })).toEqual(accepted([]));
  expect(render).toHaveBeenCalledTimes(1);
  expect(render.mock.calls[0]?.[0].allows.dispatcherCommands).toContain("doctor");
  expect(render.mock.calls[0]?.[0].allows.toolScripts).toContain("aidlc-graph.ts");
  expect(render.mock.calls[0]?.[0].delegateShellFacts).toBe(projection.delegateShellFacts);
});

test("agent composition exposes a missing captured source refusal without reconstructing Markdown", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const render = mock<HostAgentRenderer>(() => ({ renderAgent: () => accepted([]), renderConductorAgent: () => accepted([]) }));
  expect(projection.projectAgents({ rulesFolder: null, method: methodSliceFixture, host: identity, render, files: [], prepare: accepted,
    channel: "copy", modelCap: null, sources: [], reviewerAgents: new Set(), tokens: tokenBindingsFixture({ harnessDir: ".claude" }) }))
    .toEqual(accepted([]));
  expect(render.mock.calls[0]?.[0].documents({ agent: {
    slug: agent("aidlc-example-agent"), source: methodSource({ kind: "agent", within: "aidlc-example-agent.md" }),
    displayName: "Example", description: "Role", examples: [], owner: { kind: "core" }, model: { kind: "tier", tier: "balanced" },
    tools: { disallowed: [] }, maxTurns: null, persona: { text: "No fallback", headings: [] },
    additions: { afterPreflight: [], endOfBody: [] },
  }, text: "authored-file", knowledge: "absorbed", reading: "whole-files",
    frontmatter: { model: "projected", effortKey: "effort", modelQuoting: "plain", insertBeforeKeys: [],
      removeKeys: [], afterProjectionLines: [] } }))
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
    channel: "copy", modelCap: null, reviewerAgents: new Set([agent("aidlc-product-agent")]),
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
  }, text: "authored-file", knowledge: "absorbed", reading: "whole-files" }))
    .toEqual(accepted("<!-- aidlc-delegated-knowledge-preflight -->\nPersona\n\n---\n\n<!-- Absorbed at build time from knowledge/aidlc-product-agent/check.md - edit that file, not this generated copy. -->\n\nPlugin reviewer knowledge\n"));
});

test("Projection exposes the exact facts instance its native data route receives", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const projection = createBuildProjection({ hostFiles: fileSystem, sessionFiles: fileSystem, runnerScratch: fileSystem,
    runnerProcess: createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) }),
    runnerFrames: new URL("file:///frames/"), runnerChild: new URL("file:///child.ts") });
  const renderData = mock<HostDataRenderer>(() => ({ productName: "Facts", configNextStep: "Open", rulesFolder: null }));
  projection.projectHostSurface({ host: identity, files: [], placements: [], prepare: accepted,
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }), channel: "copy", renderData });
  expect(renderData).toHaveBeenCalledTimes(1);
  expect(renderData.mock.calls[0]?.[0]?.delegateShellFacts).toBe(projection.delegateShellFacts);
});
