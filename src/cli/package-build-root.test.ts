import { SCRATCH_HOST, SCRATCH_TOKENS, SCRATCH_HOST_DATA, scratchAgentRenderer, scratchCommandPlacement,
  scratchSkillRenderer, scratchSettingsRenderer, scratchDocumentRenderer }
  from "../projection/fixtures/scratch-host.fixture.ts";
import { scratchHostDistributionFixture } from "../packaging/fixtures/host-distribution.fixture.ts";
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { HOSTS } from "./host-table.ts";
import { expect, mock, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { ContentDigester } from "../kernel/content-digester-port.ts";
import { createRecordingTerminal } from "../kernel/fixtures/terminal.fake.ts";
import { hash, host, path, source } from "../kernel/fixtures/values.fixture.ts";
import type { CoreBuild, HostBuildRequest, HostModule, HostDistributionReader, Platform } from "./roots.ts";
import type { HostDocumentRenderer } from "../projection/application/ports/documents.ts";
import { createPackageBuildRoot } from "./package-build-root.ts";
import { readEveryEntry } from "../kernel/file-system-port.ts";

const files = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
};
const sources = { core: new URL("file:///core/"), plugins: new URL("file:///plugins/"),
  pluginHookTemplates: new URL("file:///hook-templates/") };
const yaml = createInMemoryYamlParser({ documents: {} });
const terminal = createRecordingTerminal();
const digester: ContentDigester = { hash: () => accepted(hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) };
const runnerFrames = new URL("file:///frames/");
const processRunner = createScriptedProcessRunner({ outcome: refused({
  kind: "not-started", reason: "No process expected",
}) });

test("one admitted core snapshot projects to multiple hosts without another source read", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const root = createPackageBuildRoot({ hosts: [],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  accept(await fileSystem.writeFile({ file: new URL("file:///core/scopes/bad.md"),
    content: { kind: "text", text: "invalid new source" } }));
  expect(accept(await root.loadCore())).toBe(core);
  expect(readTree).toHaveBeenCalledTimes(6);
  expect(JSON.parse(accept(core.project({ name: "claude", directory: ".claude", memoryRoot: "memory" })).graph))
    .toEqual([]);
  expect(JSON.parse(accept(core.project({ name: "codex", directory: ".codex", memoryRoot: "memory" })).grid))
    .toEqual({});
  expect(core.project({ name: "../outside", directory: ".claude", memoryRoot: "memory" })).toEqual({
    ok: false, refusal: { kind: "invalid-distribution-id", raw: "../outside" },
  });
});

test("plugin builds use the admitted core without re-reading changed authored core files", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const listFolder = mock<Platform["fileSystem"]["listFolder"]>(fileSystem.listFolder);
  const root = createPackageBuildRoot({ hosts: [],
    platform: { fileSystem: { ...fileSystem, listFolder }, processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  accept(await fileSystem.writeFile({ file: new URL("file:///core/scopes/bad.md"),
    content: { kind: "text", text: "invalid new core source" } }));
  const plugins = accept(await root.loadPlugins({ core }));
  expect(plugins.plugins).toEqual([]);
  expect(plugins.method.installedPlugins).toEqual([]);
  expect(listFolder).toHaveBeenCalledTimes(1);
});

test("a source refusal remains a refusal rather than a partial loaded Method", async () => {
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: createInMemoryFileSystem({ files,
    faults: { "file:///core/scopes/": "permission-denied" } }), processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  expect(await root.loadCore()).toEqual({ ok: false, refusal: [{ kind: "source-unreadable",
    location: { kind: "authored-tree", tree: "core", within: "scopes/" }, code: "permission-denied" }] });
});

test("host path refusal precedes IO and a valid capture retains its host", async () => {
  const readFile = mock<Platform["fileSystem"]["readFile"]>();
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: {
    ...createInMemoryFileSystem({ files: {} }), readFile }, processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude", root: new URL("file:///host/"),
    copied: ["../outside"], required: [] })).toEqual({ ok: false, refusal: [
    { kind: "invalid-path", base: "source", raw: "../outside" },
  ] });
  expect(readFile).not.toHaveBeenCalled();
  expect(await root.readHostSources({ name: "fixture-host", directory: ".fixture", root: new URL("file:///host/"),
    copied: [], required: [] })).toEqual({ ok: true, value: {
      host: host({ name: "fixture-host", directory: ".fixture" }), files: [],
    } });
});

test("the root wires runner process failures as source failures and removes private scratch", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const removeFolder = mock<Platform["fileSystem"]["removeFolder"]>(fileSystem.removeFolder);
  const runner = createScriptedProcessRunner({ outcome: refused({
    kind: "not-started", reason: "Runtime unavailable",
  }) });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: { ...fileSystem, removeFolder },
    processRunner: runner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  const source = await root.prepareCommandSource({ core, projectRoot: new URL("file:///assembled/"),
    harnessDir: ".claude", harnessName: "claude" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-init" })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "Runtime unavailable" } });
  expect(runner.received()).toHaveLength(1);
  expect(runner.received()[0]?.argv[0]).toBe("--no-install");
  expect(runner.received()[0]?.argv[2]).toBe("--runner-child");
  expect(runner.received()[0]?.env["AIDLC_HARNESS_DIR"]).toBe(".claude");
  expect(removeFolder).toHaveBeenCalledTimes(1);
});

test("a successful captured command is consumed synchronously after the root cleans its frame", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const removeFolder = mock<Platform["fileSystem"]["removeFolder"]>(fileSystem.removeFolder);
  const runner = createScriptedProcessRunner({ outcome: accepted({ exit: { kind: "exited", code: 0 }, stderr: "",
    stdout: '{"failure":null,"entries":[{"subject":{"concept":"orchestrator-skill","name":"aidlc-init"},"reason":null,"files":null}]}' }) });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: { ...fileSystem, removeFolder },
    processRunner: runner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  const source = await root.prepareCommandSource({ core: accept(await root.loadCore()),
    projectRoot: new URL("file:///assembled/"), harnessDir: ".claude", harnessName: "claude" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-init" })).toEqual({ ok: true, value: { kind: "declined" } });
  expect(removeFolder).toHaveBeenCalledTimes(1);
  expect(runner.received()).toHaveLength(1);
});

const surfaceFiles = {
  "file:///host/settings.json": '{"permissions":{"allow":["Bash(bun .claude/tools/aidlc-*)"]}}',
  "file:///host/skills/aidlc/SKILL.md": "Door",
  "file:///host/skills/aidlc/question-rendering.md": "Question",
  "file:///host/skills/aidlc/composer.md": "Composer",
  "file:///host/skills/aidlc/tables.md": "Tables",
  "file:///host/settings.local.json.example": "E",
  "file:///host/.mcp.json": "{}",
  "file:///host/dot-gitignore": "G",
  "file:///host/rules-aidlc.md": "R",
};

test("native placement inputs are required by capture even after their old copy rows retire", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({
    files: surfaceFiles, faults: { "file:///host/.mcp.json": "not-found" },
  }), processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] })).toEqual(refused([{
      kind: "host-source-unreadable", host: host({ name: "claude", directory: ".claude" }),
      source: source(".mcp.json"), reason: "Host source is unreadable: not-found.",
    }]));
});
import { tokenBindingsFixture } from "../projection/fixtures/token-bindings.fixture.ts";

test("settings remain required by the shared snapshot after the legacy copy row retires", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({
    files: surfaceFiles, faults: { "file:///host/settings.json": "permission-denied" },
  }), processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] })).toEqual(refused([{
      kind: "host-source-unreadable", host: host({ name: "claude", directory: ".claude" }),
      source: source("settings.json"), reason: "Host source is unreadable: permission-denied.",
    }]));
});

const distributionMembers = (): HostModule => ({
  host: SCRATCH_HOST, distribution: () => accepted(scratchHostDistributionFixture), routes: () => [],
  projection: {
    tokens: SCRATCH_TOKENS, renderData: () => SCRATCH_HOST_DATA, placements: [],
    agents: { inputs: [], render: scratchAgentRenderer }, commands: scratchCommandPlacement,
    skills: { inputs: [], render: scratchSkillRenderer },
    settings: { inputs: [], render: scratchSettingsRenderer },
    documents: { inputs: [], render: scratchDocumentRenderer },
    fills: { invoke: "/aidlc", slots: {} }, bindingHeading: "Scratch",
  },
});

const withProjection = (parts: Partial<HostModule["projection"]>): HostModule => {
  const module = distributionMembers();
  return { ...module, projection: { ...module.projection, ...parts } };
};

test("the public distribution reader supplies one captured facts instance without authored IO", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const distribution = mock<HostDistributionReader>(() => accepted(scratchHostDistributionFixture));
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(), distribution }],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  expect(root.readHostDistribution({ host: SCRATCH_HOST })).toEqual(accepted(scratchHostDistributionFixture));
  expect(root.readHostDistribution({ host: SCRATCH_HOST })).toEqual(accepted(scratchHostDistributionFixture));
  expect(distribution).toHaveBeenCalledTimes(2);
  expect(distribution.mock.calls[0]?.[0].delegateShellFacts)
    .toBe(distribution.mock.calls[1]?.[0].delegateShellFacts);
  expect(readTree).not.toHaveBeenCalled();
});

test("unknown hosts are refused by the public reader", () => {
  const root = createPackageBuildRoot({ hosts: [distributionMembers()],
    platform: { fileSystem: createInMemoryFileSystem({ files: {} }), processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  expect(root.readHostDistribution({ host: host({ name: "missing", directory: ".missing" }) }))
    .toEqual(refused([{ kind: "unknown-harness", harness: "missing" }]));
});

test("the public reader preserves the native distribution's kernel refusal", () => {
  const distribution: HostDistributionReader = () => refused({
    kind: "invalid-path", base: "project", raw: "../outside" });
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(), distribution }],
    platform: { fileSystem: createInMemoryFileSystem({ files: {} }), processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  expect(root.readHostDistribution({ host: SCRATCH_HOST }))
    .toEqual(refused([{ kind: "invalid-path", base: "project", raw: "../outside" }]));
});

const fullHostFiles = () => ({ ...files,
  "file:///core/aidlc-common/conductor.md": "Raw {{INVOKE}}",
  "file:///core/aidlc-common/protocols/.keep": "",
  "file:///core/templates/onboarding.md": "Neutral",
  "file:///core/templates/onboarding-harness.md": "Native",
  "file:///core/tools/aidlc-version.ts": 'export const AIDLC_VERSION = "fixture";',
  "file:///core/tools/aidlc-utility.ts": "captured formatter",
  "file:///core/hooks/.keep": "",
  "file:///scripts/copy-era-files.json": "{}",
  "file:///hook-templates/nested/template.txt": "Raw {{INVOKE}}\r\n",
});

const fullHostRequest = (core: CoreBuild): HostBuildRequest => ({
  host: SCRATCH_HOST, core, files: [], prepare: accepted,
  tokens: tokenBindingsFixture({ harnessDir: ".scratch" }), channel: "copy", modelCap: null,
  entrypoints: [], projectRoot: new URL("file:///assembled/"), reviewerAgents: new Set(),
});

const fullHostProcess = () => createScriptedProcessRunner({ outcome: accepted({
  exit: { kind: "exited", code: 0 }, stderr: "", stdout: '{"failure":null,"entries":[' +
    '{"subject":{"concept":"orchestrator-skill","name":"aidlc-init"},"files":null,"reason":null},' +
    '{"subject":{"concept":"orchestrator-skill","name":"aidlc-compose"},"files":null,"reason":null}]}',
}) });

test("the full host compiles once per projection and reuses raw neutral and runtime captures", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...fullHostFiles(),
    "file:///core/memory/templates/.gitkeep": "Raw {{INVOKE}} companion" } });
  const readTree = mock(fileSystem.readTree);
  const render: HostDocumentRenderer = (inputs) => ({ ...scratchDocumentRenderer(inputs),
    placeNeutralDocument: ({ document }) => accepted([{ path: path(".scratch/conductor.md"),
      content: document.content, mode: "regular",
      origin: { kind: "neutral", source: document.source } }]),
  });
  const root = createPackageBuildRoot({ hosts: [withProjection({ documents: { inputs: [], render } })],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner: fullHostProcess(), yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  const project = mock(loaded.project);
  const request = fullHostRequest({ ...loaded, project });
  const first = accept(await root.projectHost(request));
  const reads = readTree.mock.calls.length;
  accept(await fileSystem.writeFile({ file: new URL("file:///core/memory/templates/.gitkeep"),
    content: { kind: "text", text: "Changed companion after capture" } }));
  accept(await fileSystem.writeFile({ file: new URL("file:///core/aidlc-common/conductor.md"),
    content: { kind: "text", text: "Changed after capture" } }));
  const second = accept(await root.projectHost(request));
  expect(first.projection.files).toContainEqual({ path: path(".scratch/conductor.md"),
    content: { kind: "text", text: "Raw {{INVOKE}}" }, mode: "regular",
    origin: { kind: "neutral", source: source("aidlc-common/conductor.md") } });
  expect(second.projection.files).toEqual(first.projection.files);
  expect(first.projection.files).toContainEqual({ path: path("aidlc/spaces/default/memory/templates/.gitkeep"),
    content: { kind: "bytes", bytes: new TextEncoder().encode("Raw {{INVOKE}} companion") },
    mode: "regular",
    origin: { kind: "memory-companion", copy: "space", source: source("memory/templates/.gitkeep") } });
  expect(project).toHaveBeenCalledTimes(2);
  expect(project).toHaveBeenNthCalledWith(1, {
    name: "scratch", directory: ".scratch", memoryRoot: "aidlc/spaces/default/memory",
  });
  expect(readTree).toHaveBeenCalledTimes(reads);
  expect(first.projection.files).toContainEqual({ path: path("aidlc/active-space"),
    content: { kind: "text", text: "default\n" }, mode: "regular",
    origin: { kind: "active-space" } });
});

test("the full host refuses an unknown distribution before compiling or reading neutral inputs", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  const project = mock(loaded.project);
  expect(await root.projectHost(fullHostRequest({ ...loaded, project })))
    .toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
  expect(project).not.toHaveBeenCalled();
});

test("the full host refuses a declared missing authored placement before compiling", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const root = createPackageBuildRoot({ hosts: [withProjection({
    placements: [{ source: "settings.json", destination: ".scratch/settings.json" }] })],
    platform: { fileSystem, processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  const project = mock(loaded.project);
  expect(await root.projectHost(fullHostRequest({ ...loaded, project }))).toEqual(refused([{
    kind: "render-failed", concept: "host-data", name: "settings.json",
    reason: "The declared authored host file was not captured.",
  }]));
  expect(project).not.toHaveBeenCalled();
});

test("the full host preserves neutral source failures instead of returning partial files", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles(), faults: {
    ["file:///core/templates/onboarding.md"]: "permission-denied",
  } });
  const root = createPackageBuildRoot({ hosts: [distributionMembers()],
    platform: { fileSystem, processRunner, yaml, digester, terminal }, outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  expect(await root.projectHost(fullHostRequest(loaded))).toEqual(refused([{
    kind: "neutral-source-unreadable", source: source("templates/onboarding.md"), reason: "permission-denied",
  }]));
});

test("the root hands the Projection-bound settings capabilities to its callers", () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  expect(root.settingsCapabilities.extendedSubprocessTimeoutMs).toBeGreaterThan(0);
});

test("buildPayload refuses an unknown distribution before compiling", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  expect(await root.buildPayload({ ...fullHostRequest(loaded), copy: null }))
    .toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
});

test("buildPayload lays a routed host's projection out as a hashed payload", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const layout = { ...scratchHostDistributionFixture.layout, managedDirectories: [
    ...scratchHostDistributionFixture.layout.managedDirectories,
    { path: path("aidlc"), ownership: "whole-directory" as const }] };
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(),
    distribution: () => accepted({ ...scratchHostDistributionFixture, layout }) }],
    platform: { fileSystem, processRunner: fullHostProcess(), yaml, digester, terminal }, outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  const built = await root.buildPayload({ ...fullHostRequest(loaded), copy: null });
  expect(accept(built).files).toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/aidlc-stamp.json") }));
});


test("copy and native payloads share captured history while Projection keeps the raw version module", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const readFile = mock(fileSystem.readFile);
  const layout = { ...scratchHostDistributionFixture.layout, managedDirectories: [
    ...scratchHostDistributionFixture.layout.managedDirectories,
    { path: path("aidlc"), ownership: "whole-directory" as const }] };
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(),
    distribution: () => accepted({ ...scratchHostDistributionFixture, layout }) }],
    platform: { fileSystem: { ...fileSystem, readFile }, processRunner: fullHostProcess(), yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  const request = fullHostRequest(core);
  const projected = accept(await root.projectHost(request));
  expect(projected.projection.files).toContainEqual(expect.objectContaining({
    path: path(".scratch/tools/aidlc-version.ts"),
    content: { kind: "text", text: 'export const AIDLC_VERSION = "fixture";' } }));
  const copy = accept(await root.buildPayload({ ...request, copy: null }));
  accept(await fileSystem.writeFile({ file: new URL("file:///scripts/copy-era-files.json"),
    content: { kind: "text", text: "invalid after capture" } }));
  readFile.mockClear();
  const native = accept(await root.buildPayload({ ...request, channel: "native", copy }));
  expect(native.files).toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/aidlc-projection.json"),
    content: { kind: "text", text: expect.stringContaining('"retiredCopyFileHashes": {}') } }));
  expect(readFile).not.toHaveBeenCalled();
});

test("only native metadata sees plugin authoring files, with one immutable template capture", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const readTree = mock(fileSystem.readTree);
  const layout = { ...scratchHostDistributionFixture.layout, managedDirectories: [
    ...scratchHostDistributionFixture.layout.managedDirectories,
    { path: path("aidlc"), ownership: "whole-directory" as const }] };
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(),
    distribution: () => accepted({ ...scratchHostDistributionFixture, layout }) }],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner: fullHostProcess(), yaml, digester, terminal },
    outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  const request = fullHostRequest(core);
  const copy = accept(await root.buildPayload({ ...request, copy: null }));
  expect(copy.files).not.toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/plugin-authoring-context.json") }));
  expect(readTree).not.toHaveBeenCalledWith({ folder: sources.pluginHookTemplates, select: readEveryEntry });
  readTree.mockClear();
  const native = accept(await root.buildPayload({ ...request, channel: "native", copy }));
  expect(native.files).toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/plugin-targets.json") }));
  expect(native.files).toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/plugin-authoring-context.json") }));
  expect(readTree).toHaveBeenCalledTimes(1);
  expect(readTree).toHaveBeenCalledWith({ folder: sources.pluginHookTemplates, select: readEveryEntry });
  expect(native.files).toContainEqual(expect.objectContaining({
    path: path(".scratch/tools/data/plugin-hooks-template/nested/template.txt"),
    content: { kind: "bytes", bytes: new TextEncoder().encode("Raw {{INVOKE}}\r\n") },
  }));
  accept(await fileSystem.writeFile({ file: new URL("nested/template.txt", sources.pluginHookTemplates),
    content: { kind: "text", text: "Changed after capture" } }));
  const again = accept(await root.buildPayload({ ...request, channel: "native", copy }));
  expect(again.files).toEqual(native.files);
  expect(readTree).toHaveBeenCalledTimes(1);
});

test.each([["file:///hook-templates/", ""], ["file:///hook-templates/nested/template.txt", "nested/template.txt"]])(
  "a native template failure at %s refuses the payload", async (location, within) => {
    const fileSystem = createInMemoryFileSystem({ files: fullHostFiles(), faults: { [location]: "permission-denied" } });
    const root = createPackageBuildRoot({ hosts: [distributionMembers()],
      platform: { fileSystem, processRunner: fullHostProcess(), yaml, digester, terminal }, outliner, sources, runnerFrames });
    const core = accept(await root.loadCore());
    expect(await root.buildPayload({ ...fullHostRequest(core), channel: "native", copy: null }))
      .toEqual(refused([{ kind: "plugin-hook-template-unreadable",
        within, code: "permission-denied" }]));
  });

test("native authoring files refuse a collision with the host projection", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const placeNeutralDocument = mock<ReturnType<HostDocumentRenderer>["placeNeutralDocument"]>()
    .mockReturnValue(accepted([])).mockReturnValueOnce(accepted([{
      path: path(".scratch/tools/data/plugin-targets.json"), mode: "regular",
      content: { kind: "text", text: "host-owned" },
      origin: { kind: "neutral", source: source("aidlc-common/conductor.md") },
    }]));
  const render: HostDocumentRenderer = (inputs) => ({ ...scratchDocumentRenderer(inputs),
    placeNeutralDocument,
  });
  const root = createPackageBuildRoot({ hosts: [withProjection({ documents: { inputs: [], render } })],
    platform: { fileSystem, processRunner: fullHostProcess(), yaml, digester, terminal }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(await root.buildPayload({ ...fullHostRequest(core), channel: "native", copy: null })).toEqual(refused([{
    kind: "path-collision", path: path(".scratch/tools/data/plugin-targets.json"), origins: [
      { kind: "neutral", source: source("aidlc-common/conductor.md") },
      { kind: "runtime-data", name: "plugin-targets" },
    ],
  }]));
});
