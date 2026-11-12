import { SCRATCH_HOST, SCRATCH_TOKENS, SCRATCH_HOST_DATA, scratchAgentRenderer, scratchCommandPlacement,
  scratchSkillRenderer, scratchSettingsRenderer, scratchDocumentRenderer }
  from "../projection/fixtures/scratch-host.fixture.ts";
import { scratchHostDistributionFixture } from "../packaging/fixtures/host-distribution.fixture.ts";
import type { ProjectedFile } from "../projection/domain/projected-file.ts";
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { HOSTS } from "./host-table.ts";
import { expect, mock, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { ContentDigester } from "../kernel/content-digester-port.ts";
import { hash, host, path, source } from "../kernel/fixtures/values.fixture.ts";
import type { CoreBuild, HostBuildRequest, HostModule, HostDistributionReader, Platform } from "./roots.ts";
import type { HostDocumentRenderer } from "../projection/application/ports/documents.ts";
import { createPackageBuildRoot } from "./package-build-root.ts";

const files = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
};
const sources = { core: new URL("file:///core/"), plugins: new URL("file:///plugins/") };
const yaml = createInMemoryYamlParser({ documents: {} });
const digester: ContentDigester = { hash: () => accepted(hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) };
const runnerFrames = new URL("file:///frames/");
const processRunner = createScriptedProcessRunner({ outcome: refused({
  kind: "not-started", reason: "No process expected",
}) });

test("one admitted core snapshot projects to multiple hosts without another source read", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const root = createPackageBuildRoot({ hosts: [],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml, digester },
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
    platform: { fileSystem: { ...fileSystem, listFolder }, processRunner, yaml, digester },
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
    faults: { "file:///core/scopes/": "permission-denied" } }), processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  expect(await root.loadCore()).toEqual({ ok: false, refusal: [{ kind: "source-unreadable",
    location: { kind: "authored-tree", tree: "core", within: "scopes/" }, code: "permission-denied" }] });
});

test("host path refusal precedes IO and a valid capture retains its host", async () => {
  const readFile = mock<Platform["fileSystem"]["readFile"]>();
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: {
    ...createInMemoryFileSystem({ files: {} }), readFile }, processRunner, yaml, digester }, outliner, sources, runnerFrames });
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
    processRunner: runner, yaml, digester }, outliner, sources, runnerFrames });
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
    processRunner: runner, yaml, digester }, outliner, sources, runnerFrames });
  const source = await root.prepareCommandSource({ core: accept(await root.loadCore()),
    projectRoot: new URL("file:///assembled/"), harnessDir: ".claude", harnessName: "claude" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-init" })).toEqual({ ok: true, value: { kind: "declined" } });
  expect(removeFolder).toHaveBeenCalledTimes(1);
  expect(runner.received()).toHaveLength(1);
});

test("the real root omits unregistered agent hosts", async () => {
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: createInMemoryFileSystem({ files }),
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(root.projectAgents({ rulesFolder: null, host: host({ name: "fixture-host", directory: ".fixture" }), method: core.method,
    sources: core.sources, reviewerAgents: new Set(), tokens: tokenBindingsFixture({ harnessDir: ".claude" }),
    files: [], prepare: accepted, channel: "copy", modelCap: null })).toEqual(accepted([]));
});

test("the real root renders a captured Kiro conductor without replacing its model", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({ files }),
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(root.projectAgents({ rulesFolder: null, host: host({ name: "kiro", directory: ".kiro" }), method: core.method,
    sources: core.sources, reviewerAgents: new Set(), tokens: tokenBindingsFixture({ harnessDir: ".kiro" }),
    files: [
      { source: source("agents/aidlc.json"), content: { kind: "text", text: '{ "model": "personal" }\r\n' } },
      { source: source("agents/aidlc-architect-agent.json"), content: { kind: "text", text:
        '{"name":"aidlc-architect-agent","toolsSettings":{"execute_bash":{"allowedCommands":["bun (run )?[\\"\']?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\"\']?( .*)?"]}}}' } },
    ],
    prepare: accepted, channel: "native", modelCap: null })).toEqual(accepted([{
      path: path(".kiro/agents/aidlc.json"), content: { kind: "text", text: '{ "model": "personal" }\r\n' },
      mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: source("agents/aidlc.json") },
    }]));
});
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { claudeCommandPath } from "../hosts/claude/projection/command-renderer.ts";
import type { CommandSource } from "../projection/application/ports/commands.ts";

const skillFiles = [
  { source: source("skills/aidlc/SKILL.md"), content: { kind: "text", text: "Door\n" } },
  { source: source("skills/aidlc/question-rendering.md"), content: { kind: "text", text: "Question\n" } },
  { source: source("skills/aidlc/composer.md"), content: { kind: "text", text: "Composer\n" } },
  { source: source("skills/aidlc/tables.md"), content: { kind: "text", text: "Tables\n" } },
] as const;
const skillTokens = { ["HARNESS_DIR"]: ".claude", ["INVOKE"]: "aidlc", ["SKILL_INVOKE"]: null,
  ["TOOL_PREFIX"]: "aidlc ", ["TRUSTED_NAMESPACE"]: "trusted", ["OPTION_LETTERS"]: "A-D" } as const;

test("the skill route omits unregistered hosts without reading neutral sources", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const root = createPackageBuildRoot({ hosts: [],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  expect(await root.projectSkills({ host: host({ name: "fixture-host", directory: ".fixture" }),
    projectRoot: new URL("file:///built/"), method: methodSliceFixture, files: [], prepare: accepted,
    commands: { read: () => accepted({ kind: "declined" }) }, place: claudeCommandPath, tokens: skillTokens }))
    .toEqual(accepted([]));
  expect(readTree).not.toHaveBeenCalled();
});

test("the real skill route composes B and C once and captures neutral skills once", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///core/skills/aidlc-replay/SKILL.md": "R",
  } });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const runner = createScriptedProcessRunner({ outcome: accepted({ exit: { kind: "exited", code: 0 },
    stdout: "Unused table without markers", stderr: "" }) });
  const root = createPackageBuildRoot({ hosts: HOSTS,
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner: runner, yaml, digester },
    outliner, sources, runnerFrames });
  const read = mock<CommandSource["read"]>(() => accepted({ kind: "declined" }));
  const prepare = mock(accepted);
  const skillRequest = { host: host({ name: "claude", directory: ".claude" }),
    projectRoot: new URL("file:///built/"), method: methodSliceFixture, files: skillFiles,
    prepare, commands: { read }, place: claudeCommandPath, tokens: skillTokens };
  const expected: readonly ProjectedFile[] = [
    { path: path(".claude/skills/aidlc/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Door\n\n<!-- BEGIN: compiled scope grid via an earlier release's refresh --><!-- BEGIN: compiled stage graph via --><!-- END: compiled stage graph --><!-- END: compiled scope grid -->\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/SKILL.md") } },
    { path: path(".claude/skills/aidlc/question-rendering.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Question\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/question-rendering.md") } },
    { path: path(".claude/skills/aidlc/composer.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Composer\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/composer.md") } },
    { path: path(".claude/skills/aidlc/tables.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new TextEncoder().encode("Tables\n") },
      origin: { kind: "harness-authored", source: source("skills/aidlc/tables.md") } },
    { path: path(".claude/skills/aidlc-replay/SKILL.md"), mode: "regular", availability: "always",
      content: { kind: "bytes", bytes: new Uint8Array([82]) },
      origin: { kind: "neutral", source: source("skills/aidlc-replay/SKILL.md") } },
  ];
  expect(accept(await root.projectSkills(skillRequest))).toEqual(expected);
  expect(read).toHaveBeenCalledTimes(7);
  expect(prepare).toHaveBeenCalledTimes(4);
  expect(runner.received()).toHaveLength(2);
  expect(readTree).toHaveBeenCalledTimes(1);
  accept(await fileSystem.writeFile({ file: new URL("file:///core/skills/aidlc-replay/SKILL.md"),
    content: { kind: "text", text: "Changed after capture" } }));
  expect(accept(await root.projectSkills(skillRequest))).toEqual(expected);
  expect(readTree).toHaveBeenCalledTimes(1);
});
test("registered Kiro skills refuse the actual missing captured orchestrator input", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({ files: {} }),
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(await root.projectSkills({ host: host({ name: "kiro", directory: ".kiro" }),
    projectRoot: new URL("file:///built/"), method: methodSliceFixture, files: [], prepare: accepted,
    commands: { read: () => accepted({ kind: "declined" }) }, place: claudeCommandPath, tokens: skillTokens }))
    .toEqual(refused({ kind: "render-failed", concept: "orchestrator-skill", name: "skills/aidlc/SKILL.md",
      reason: "The authored orchestrator document was not captured." }));
});
test("the standalone surface route omits an unregistered host without IO or preparation", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const readFile = mock<Platform["fileSystem"]["readFile"]>(fileSystem.readFile);
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const prepare = mock(accepted);
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: { ...fileSystem, readFile, readTree },
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(root.projectHostSurface({ host: host({ name: "fixture-host", directory: ".fixture" }),
    files: [], prepare, tokens: skillTokens, channel: "copy" })).toEqual(accepted([]));
  expect(readFile).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
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

test("the real surface route uses one captured snapshot and preserves exact native placement bytes", async () => {
  const fileSystem = createInMemoryFileSystem({ files: surfaceFiles });
  const readFile = mock<Platform["fileSystem"]["readFile"]>(fileSystem.readFile);
  const prepare = mock(accepted);
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: { ...fileSystem, readFile },
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  const captured = accept(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] }));
  const surfaceRequest = { host: captured.host, files: captured.files,
    prepare, tokens: skillTokens, channel: "copy" } as const;
  const projected = root.projectHostSurface(surfaceRequest);
  expect(projected).toMatchObject({ ok: true, value: [
    { path: path(".claude/tools/data/harness.json"), content: { kind: "text" } },
    { path: path(".claude/settings.local.json.example"), content: { kind: "bytes", bytes: new Uint8Array([69]) } },
    { path: path(".mcp.json"), content: { kind: "bytes", bytes: new Uint8Array([123, 125]) } },
    { path: path(".gitignore"), content: { kind: "bytes", bytes: new Uint8Array([71]) } },
    { path: path(".claude/rules/aidlc.md"), content: { kind: "bytes", bytes: new Uint8Array([82]) } },
  ] });
  expect(readFile).toHaveBeenCalledTimes(9);
  expect(prepare).toHaveBeenCalledTimes(4);
  accept(await fileSystem.writeFile({ file: new URL("file:///host/dot-gitignore"),
    content: { kind: "text", text: "Changed after capture" } }));
  expect(root.projectHostSurface(surfaceRequest)).toEqual(projected);
  expect(readFile).toHaveBeenCalledTimes(9);
});

test("native placement inputs are required by capture even after their old copy rows retire", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({
    files: surfaceFiles, faults: { "file:///host/.mcp.json": "not-found" },
  }), processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] })).toEqual(refused([{
      kind: "host-source-unreadable", host: host({ name: "claude", directory: ".claude" }),
      source: source(".mcp.json"), reason: "Host source is unreadable: not-found.",
    }]));
});
import { tokenBindingsFixture } from "../projection/fixtures/token-bindings.fixture.ts";

test("an unregistered settings host performs no source read or preparation", () => {
  const fileSystem = createInMemoryFileSystem({ files: {} });
  const readFile = mock<Platform["fileSystem"]["readFile"]>(fileSystem.readFile);
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const prepare = mock(accepted);
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem: { ...fileSystem, readFile, readTree },
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(root.projectSettings({ host: host({ name: "fixture-host", directory: ".fixture" }),
    method: methodSliceFixture, files: [], prepare, tokens: skillTokens, channel: "copy", entrypoints: [], modelCap: null }))
    .toEqual(accepted([]));
  expect(readFile).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
});

test("the real settings route uses the captured file once, with shipped allows and no second hook file", async () => {
  const fileSystem = createInMemoryFileSystem({ files: surfaceFiles });
  const readFile = mock<Platform["fileSystem"]["readFile"]>(fileSystem.readFile);
  const root = createPackageBuildRoot({ hosts: HOSTS,
    platform: { fileSystem: { ...fileSystem, readFile }, processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  const captured = accept(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] }));
  const prepare = mock(accepted);
  const settingsRequest = { host: captured.host, method: methodSliceFixture, files: captured.files,
    prepare, tokens: skillTokens, channel: "copy", entrypoints: [], modelCap: null } as const;
  const settings = root.projectSettings(settingsRequest);
  expect(settings).toHaveProperty("value.length", 1);
  expect(settings).toHaveProperty("value.0.path", path(".claude/settings.json"));
  expect(settings).toHaveProperty("value.0.origin", {
    kind: "rendered", concept: "settings", name: "settings.json",
  });
  expect(settings).toHaveProperty("value.0.content", { kind: "text",
    text: expect.stringContaining('"Bash(bun .claude/tools/aidlc.ts doctor)"'),
  });
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(readFile).toHaveBeenCalledTimes(9);
  await fileSystem.writeFile({ file: new URL("file:///host/settings.json"),
    content: { kind: "text", text: "changed after capture" } });
  expect(root.projectSettings(settingsRequest)).toEqual(settings);
  expect(readFile).toHaveBeenCalledTimes(9);
});

test("settings remain required by the shared snapshot after the legacy copy row retires", async () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({
    files: surfaceFiles, faults: { "file:///host/settings.json": "permission-denied" },
  }), processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] })).toEqual(refused([{
      kind: "host-source-unreadable", host: host({ name: "claude", directory: ".claude" }),
      source: source("settings.json"), reason: "Host source is unreadable: permission-denied.",
    }]));
});

test("the actual settings route preserves the missing-glob failure instead of shipping partial settings", () => {
  const root = createPackageBuildRoot({ hosts: HOSTS, platform: { fileSystem: createInMemoryFileSystem({ files: {} }),
    processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(root.projectSettings({ host: host({ name: "claude", directory: ".claude" }),
    method: methodSliceFixture, files: [{ source: source("settings.json"),
      content: { kind: "text", text: '{"permissions":{"allow":["Edit(/**)"]}}' } }],
    prepare: accepted, tokens: skillTokens, channel: "copy", entrypoints: [], modelCap: null })).toEqual(refused({
      kind: "render-failed", concept: "settings", name: "settings.json",
      reason: "settings.json has no Bash(bun <dir>/tools/aidlc-*) entry to expand",
    }));
});

test("registered document projection captures neutral sources once while an unregistered host reads nothing", async () => {
  const fileSystem = createInMemoryFileSystem({ files: { ...files,
    "file:///core/aidlc-common/conductor.md": "Conductor",
    "file:///core/aidlc-common/protocols/one.md": "Protocol {{HARNESS_DIR}}",
    "file:///core/templates/onboarding.md": "Neutral\n",
    "file:///core/templates/onboarding-harness.md": "Native {{SKILL_INVOKE}}\n",
  } });
  const readFile = mock(fileSystem.readFile);
  const root = createPackageBuildRoot({ hosts: HOSTS,
    platform: { fileSystem: { ...fileSystem, readFile }, processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  const documents = { core, fills: { invoke: "/aidlc", slots: {} },
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }) };
  expect(await root.projectDocuments({ ...documents, host: host({ name: "fixture-host", directory: ".fixture" }) }))
    .toEqual(accepted([]));
  expect(readFile).not.toHaveBeenCalled();
  expect(accept(await root.projectDocuments({ ...documents, host: host({ name: "claude", directory: ".claude" }) })))
    .toEqual([
      { path: path(".claude/CLAUDE.md"), mode: "regular", availability: "always",
        origin: { kind: "rendered", concept: "onboarding", name: ".claude/CLAUDE.md" },
        content: { kind: "text", text: "Native /aidlc\n\n## Shared AI-DLC onboarding\n\nNeutral\n" } },
      { path: path(".claude/aidlc-common/conductor.md"), mode: "regular", availability: "always",
        origin: { kind: "neutral", source: source("aidlc-common/conductor.md") },
        content: { kind: "text", text: "Conductor" } },
      { path: path(".claude/aidlc-common/protocols/one.md"), mode: "regular", availability: "always",
        origin: { kind: "neutral", source: source("aidlc-common/protocols/one.md") },
        content: { kind: "text", text: "Protocol .claude" } },
    ]);
  accept(await fileSystem.writeFile({ file: new URL("file:///core/aidlc-common/conductor.md"),
    content: { kind: "text", text: "Changed after capture" } }));
  expect(accept(await root.projectDocuments({ ...documents,
    host: host({ name: "claude", directory: ".claude" }) }))[1]?.content)
    .toEqual({ kind: "text", text: "Conductor" });
  expect(readFile).toHaveBeenCalledTimes(3);
});

test("the document root preserves all neutral capture failures", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const root = createPackageBuildRoot({ hosts: HOSTS,
    platform: { fileSystem, processRunner, yaml, digester }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(await root.projectDocuments({ core,
    host: host({ name: "claude", directory: ".claude" }), fills: { invoke: "/aidlc", slots: {} },
    tokens: tokenBindingsFixture({ harnessDir: ".claude" }) })).toEqual(refused([
    { kind: "neutral-source-unreadable", source: source("aidlc-common/conductor.md"), reason: "not-found" },
    { kind: "neutral-source-unreadable", source: source("templates/onboarding.md"), reason: "not-found" },
    { kind: "neutral-source-unreadable", source: source("templates/onboarding-harness.md"), reason: "not-found" },
    { kind: "neutral-source-unreadable", source: source("aidlc-common/protocols"), reason: "not-found" },
  ]));
});

const distributionMembers = (): HostModule => ({
  host: SCRATCH_HOST, distribution: () => accepted(scratchHostDistributionFixture),
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
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml, digester }, outliner, sources, runnerFrames });
  expect(root.readHostDistribution({ host: SCRATCH_HOST })).toEqual(accepted(scratchHostDistributionFixture));
  expect(root.readHostDistribution({ host: SCRATCH_HOST })).toEqual(accepted(scratchHostDistributionFixture));
  expect(distribution).toHaveBeenCalledTimes(2);
  expect(distribution.mock.calls[0]?.[0].delegateShellFacts)
    .toBe(distribution.mock.calls[1]?.[0].delegateShellFacts);
  expect(readTree).not.toHaveBeenCalled();
});

test("unknown hosts are refused by the public reader", () => {
  const root = createPackageBuildRoot({ hosts: [distributionMembers()],
    platform: { fileSystem: createInMemoryFileSystem({ files: {} }), processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  expect(root.readHostDistribution({ host: host({ name: "missing", directory: ".missing" }) }))
    .toEqual(refused([{ kind: "unknown-harness", harness: "missing" }]));
});

test("the public reader preserves the native distribution's kernel refusal", () => {
  const distribution: HostDistributionReader = () => refused({
    kind: "invalid-path", base: "project", raw: "../outside" });
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(), distribution }],
    platform: { fileSystem: createInMemoryFileSystem({ files: {} }), processRunner, yaml, digester },
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
      content: document.content, mode: "regular", availability: "always",
      origin: { kind: "neutral", source: document.source } }]),
  });
  const root = createPackageBuildRoot({ hosts: [withProjection({ documents: { inputs: [], render } })],
    platform: { fileSystem: { ...fileSystem, readTree }, processRunner: fullHostProcess(), yaml, digester },
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
    content: { kind: "text", text: "Raw {{INVOKE}}" }, mode: "regular", availability: "always",
    origin: { kind: "neutral", source: source("aidlc-common/conductor.md") } });
  expect(second.projection.files).toEqual(first.projection.files);
  expect(first.projection.files).toContainEqual({ path: path("aidlc/spaces/default/memory/templates/.gitkeep"),
    content: { kind: "bytes", bytes: new TextEncoder().encode("Raw {{INVOKE}} companion") },
    mode: "regular", availability: "always",
    origin: { kind: "memory-companion", copy: "space", source: source("memory/templates/.gitkeep") } });
  expect(project).toHaveBeenCalledTimes(2);
  expect(project).toHaveBeenNthCalledWith(1, {
    name: "scratch", directory: ".scratch", memoryRoot: "aidlc/spaces/default/memory",
  });
  expect(readTree).toHaveBeenCalledTimes(reads);
  expect(first.projection.files).toContainEqual({ path: path("aidlc/active-space"),
    content: { kind: "text", text: "default\n" }, mode: "regular", availability: "always",
    origin: { kind: "active-space" } });
});

test("the full host refuses an unknown distribution before compiling or reading neutral inputs", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester },
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
    platform: { fileSystem, processRunner, yaml, digester }, outliner, sources, runnerFrames });
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
    platform: { fileSystem, processRunner, yaml, digester }, outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  expect(await root.projectHost(fullHostRequest(loaded))).toEqual(refused([{
    kind: "neutral-source-unreadable", source: source("templates/onboarding.md"), reason: "permission-denied",
  }]));
});

test("the root hands the Projection-bound settings capabilities to its callers", () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  expect(root.settingsCapabilities.extendedSubprocessTimeoutMs).toBeGreaterThan(0);
});

test("buildPayload refuses an unknown distribution before compiling", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const root = createPackageBuildRoot({ hosts: [], platform: { fileSystem, processRunner, yaml, digester },
    outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  expect(await root.buildPayload(fullHostRequest(loaded)))
    .toEqual(refused([{ kind: "unknown-harness", harness: "scratch" }]));
});

test("buildPayload lays a routed host's projection out as a hashed payload", async () => {
  const fileSystem = createInMemoryFileSystem({ files: fullHostFiles() });
  const layout = { ...scratchHostDistributionFixture.layout, managedDirectories: [
    ...scratchHostDistributionFixture.layout.managedDirectories,
    { path: path("aidlc"), ownership: "whole-directory" as const }] };
  const root = createPackageBuildRoot({ hosts: [{ ...distributionMembers(),
    distribution: () => accepted({ ...scratchHostDistributionFixture, layout }) }],
    platform: { fileSystem, processRunner: fullHostProcess(), yaml, digester }, outliner, sources, runnerFrames });
  const loaded = accept(await root.loadCore());
  const built = await root.buildPayload(fullHostRequest(loaded));
  expect(accept(built).files).toContainEqual(expect.objectContaining({ path: path(".scratch/tools/data/aidlc-stamp.json") }));
});
