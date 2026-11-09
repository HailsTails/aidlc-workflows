import type { ProjectedFile } from "../projection/domain/projected-file.ts";
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { expect, mock, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import { host, path, source } from "../kernel/fixtures/values.fixture.ts";
import type { Platform } from "./roots.ts";
import { createPackageBuildRoot } from "./package-build-root.ts";

const files = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
};
const sources = { core: new URL("file:///core/"), plugins: new URL("file:///plugins/") };
const yaml = createInMemoryYamlParser({ documents: {} });
const runnerFrames = new URL("file:///frames/");
const processRunner = createScriptedProcessRunner({ outcome: refused({
  kind: "not-started", reason: "No process expected",
}) });

test("one admitted core snapshot projects to multiple hosts without another source read", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const readTree = mock<Platform["fileSystem"]["readTree"]>(fileSystem.readTree);
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml },
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, listFolder }, processRunner, yaml },
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
  const root = createPackageBuildRoot({ platform: { fileSystem: createInMemoryFileSystem({ files,
    faults: { "file:///core/scopes/": "permission-denied" } }), processRunner, yaml },
    outliner, sources, runnerFrames });
  expect(await root.loadCore()).toEqual({ ok: false, refusal: [{ kind: "source-unreadable",
    location: { kind: "authored-tree", tree: "core", within: "scopes/" }, code: "permission-denied" }] });
});

test("host path refusal precedes IO and a valid capture retains its host", async () => {
  const readFile = mock<Platform["fileSystem"]["readFile"]>();
  const root = createPackageBuildRoot({ platform: { fileSystem: {
    ...createInMemoryFileSystem({ files: {} }), readFile }, processRunner, yaml }, outliner, sources, runnerFrames });
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, removeFolder },
    processRunner: runner, yaml }, outliner, sources, runnerFrames });
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, removeFolder },
    processRunner: runner, yaml }, outliner, sources, runnerFrames });
  const source = await root.prepareCommandSource({ core: accept(await root.loadCore()),
    projectRoot: new URL("file:///assembled/"), harnessDir: ".claude", harnessName: "claude" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-init" })).toEqual({ ok: true, value: { kind: "declined" } });
  expect(removeFolder).toHaveBeenCalledTimes(1);
  expect(runner.received()).toHaveLength(1);
});

test("the real root omits unregistered agent hosts", async () => {
  const root = createPackageBuildRoot({ platform: { fileSystem: createInMemoryFileSystem({ files }),
    processRunner, yaml }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(root.projectAgents({ host: host({ name: "claude", directory: ".claude" }), method: core.method,
    files: [], prepare: accepted, channel: "copy", modelCap: null })).toEqual(accepted([]));
});

test("the real root renders a captured Kiro conductor without replacing its model", async () => {
  const root = createPackageBuildRoot({ platform: { fileSystem: createInMemoryFileSystem({ files }),
    processRunner, yaml }, outliner, sources, runnerFrames });
  const core = accept(await root.loadCore());
  expect(root.projectAgents({ host: host({ name: "kiro", directory: ".kiro" }), method: core.method,
    files: [{ source: source("agents/aidlc.json"), content: { kind: "text", text: '{ "model": "personal" }\r\n' } }],
    prepare: accepted, channel: "native", modelCap: null })).toEqual(accepted([{
      path: path(".kiro/agents/aidlc.json"), content: { kind: "text", text: '{ "model": "personal" }\r\n' },
      mode: "regular", availability: "always",
      origin: { kind: "harness-authored", source: source("agents/aidlc.json") },
    }]));
});
import { methodSliceFixture } from "../workflow-definition/fixtures/method.fixture.ts";
import { claudeCommandPath } from "../hosts/claude/projection/command-renderer.ts";
import type { CommandSource } from "../projection/application/ports.ts";

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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, readTree }, processRunner, yaml },
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, readTree }, processRunner: runner, yaml },
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
  const root = createPackageBuildRoot({ platform: { fileSystem: createInMemoryFileSystem({ files: {} }),
    processRunner, yaml }, outliner, sources, runnerFrames });
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, readFile, readTree },
    processRunner, yaml }, outliner, sources, runnerFrames });
  expect(root.projectHostSurface({ host: host({ name: "fixture-host", directory: ".fixture" }),
    files: [], prepare, tokens: skillTokens, channel: "copy" })).toEqual(accepted([]));
  expect(readFile).not.toHaveBeenCalled();
  expect(readTree).not.toHaveBeenCalled();
  expect(prepare).not.toHaveBeenCalled();
});

const surfaceFiles = {
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
  const root = createPackageBuildRoot({ platform: { fileSystem: { ...fileSystem, readFile },
    processRunner, yaml }, outliner, sources, runnerFrames });
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
  expect(readFile).toHaveBeenCalledTimes(8);
  expect(prepare).toHaveBeenCalledTimes(4);
  accept(await fileSystem.writeFile({ file: new URL("file:///host/dot-gitignore"),
    content: { kind: "text", text: "Changed after capture" } }));
  expect(root.projectHostSurface(surfaceRequest)).toEqual(projected);
  expect(readFile).toHaveBeenCalledTimes(8);
});

test("native placement inputs are required by capture even after their old copy rows retire", async () => {
  const root = createPackageBuildRoot({ platform: { fileSystem: createInMemoryFileSystem({
    files: surfaceFiles, faults: { "file:///host/.mcp.json": "not-found" },
  }), processRunner, yaml }, outliner, sources, runnerFrames });
  expect(await root.readHostSources({ name: "claude", directory: ".claude",
    root: new URL("file:///host/"), copied: [], required: [] })).toEqual(refused([{
      kind: "host-source-unreadable", host: host({ name: "claude", directory: ".claude" }),
      source: source(".mcp.json"), reason: "Host source is unreadable: not-found.",
    }]));
});