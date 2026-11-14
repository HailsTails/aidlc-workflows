import { HOSTS } from "./host-table.ts";
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createRecordingTerminal } from "../kernel/fixtures/terminal.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import { hash } from "../kernel/fixtures/values.fixture.ts";
import type { ContentDigester } from "../kernel/content-digester-port.ts";
import type { CommandRoute, CreatePackageBuildRoot, PackageBuildRoot } from "./roots.ts";
import { openPackageBuildRoot, runPackageCommand } from "./main.ts";
import { createRecordingPluginProjector } from "../projection/fixtures/plugin-projector.fake.ts";

const fileSystem = createInMemoryFileSystem({ files: {} });
const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
const yaml = createInMemoryYamlParser({ documents: {} });
const terminal = createRecordingTerminal();
const digester: ContentDigester = { hash: () => accepted(hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) };
const root: PackageBuildRoot = {
  settingsCapabilities: { extendedSubprocessTimeoutMs: 1, hookTrust: () => "unused" },
  projectHost: mock<PackageBuildRoot["projectHost"]>(),
  readHostDistribution: mock<PackageBuildRoot["readHostDistribution"]>(),
  buildPayload: mock<PackageBuildRoot["buildPayload"]>(),
  buildReleaseArchives: mock<PackageBuildRoot["buildReleaseArchives"]>(),
  buildPlugins: mock<PackageBuildRoot["buildPlugins"]>(),
  buildRoutes: mock<PackageBuildRoot["buildRoutes"]>(),
  loadCore: mock<PackageBuildRoot["loadCore"]>(),
  loadPlugins: mock<PackageBuildRoot["loadPlugins"]>(),
  prepareCommandSource: mock<PackageBuildRoot["prepareCommandSource"]>(),
  readHostSources: mock<PackageBuildRoot["readHostSources"]>(),
};

test("the entry constructs each implementer once and binds its instance to the correct root port", () => {
  const createNodeFileSystem = mock(() => fileSystem);
  const createNodeProcessRunner = mock(() => processRunner);
  const createBunYamlParser = mock(() => yaml);
  const createBunContentDigester = mock(() => digester);
  const createProcessTerminal = mock(() => terminal);
  const plugins = createRecordingPluginProjector();
  const createPluginProjector = mock(() => plugins);
  const createPackageBuildRoot = mock<CreatePackageBuildRoot>(() => root);
  expect(openPackageBuildRoot({ createNodeFileSystem, createNodeProcessRunner,
    createBunYamlParser, createBunContentDigester, createProcessTerminal, createPluginProjector, createPackageBuildRoot, outliner,
    workingDirectory: new URL("file:///H:/working/") })).toBe(root);
  expect(createNodeFileSystem).toHaveBeenCalledTimes(1);
  expect(createNodeProcessRunner).toHaveBeenCalledTimes(1);
  expect(createBunYamlParser).toHaveBeenCalledTimes(1);
  expect(createBunContentDigester).toHaveBeenCalledTimes(1);
  expect(createProcessTerminal).toHaveBeenCalledTimes(1);
  expect(createPluginProjector).toHaveBeenCalledTimes(1);
  expect(createPluginProjector).toHaveBeenCalledWith({
    hookTemplates: new URL("../../scripts/plugin-hooks-template/", import.meta.url) });
  expect(createPackageBuildRoot).toHaveBeenCalledTimes(1);
  expect(createPackageBuildRoot).toHaveBeenCalledWith({ hosts: HOSTS, outliner,
    workingDirectory: new URL("file:///H:/working/"), plugins,
    platform: { fileSystem, processRunner, yaml, digester, terminal },
    sources: { core: new URL("../../core/", import.meta.url), plugins: new URL("../../plugins/", import.meta.url),
      pluginHookTemplates: new URL("../../scripts/plugin-hooks-template/", import.meta.url) },
    runnerFrames: new URL("../../.cache/runner-frames/", import.meta.url),
  });
});

const compositionFor = (routes: readonly CommandRoute[]) => ({
  workingDirectory: new URL("file:///H:/working/"), outliner,
  createNodeFileSystem: () => fileSystem,
  createNodeProcessRunner: () => processRunner,
  createBunYamlParser: () => yaml,
  createBunContentDigester: () => digester,
  createProcessTerminal: mock(() => terminal),
  createPluginProjector: () => createRecordingPluginProjector(),
  createPackageBuildRoot: mock<CreatePackageBuildRoot>(() => ({ ...root, buildRoutes: () => routes })),
});

test("package dispatch selects the longest prefix independent of registration order", async () => {
  const fallback = mock<CommandRoute["run"]>(async () => 2);
  const plugin = mock<CommandRoute["run"]>(async () => 1);
  const build = mock<CommandRoute["run"]>(async () => 0);
  const composition = compositionFor([{ verb: [], run: fallback },
    { verb: ["plugin"], run: plugin }, { verb: ["plugin", "build"], run: build }]);
  expect(await runPackageCommand({ resolveModelCap: () => ({ cap: null, source: null, environment: "unset" }), argv: ["plugin", "build", "test-pro", "claude", "out"], composition })).toBe(0);
  expect(build).toHaveBeenCalledWith(["test-pro", "claude", "out"]);
  expect(plugin).not.toHaveBeenCalled();
  expect(fallback).not.toHaveBeenCalled();
  expect(composition.createProcessTerminal).toHaveBeenCalledTimes(1);
  expect(composition.createPackageBuildRoot).toHaveBeenCalledTimes(1);
});

test("the empty verb receives all remaining build arguments and its exit status passes through", async () => {
  const build = mock<CommandRoute["run"]>(async () => 1);
  const utility = mock<CommandRoute["run"]>(async () => 0);
  expect(await runPackageCommand({ resolveModelCap: () => ({ cap: null, source: null, environment: "unset" }), argv: ["codex", "--check"],
    composition: compositionFor([{ verb: ["codex", "trust"], run: utility }, { verb: [], run: build }]) })).toBe(1);
  expect(build).toHaveBeenCalledWith(["codex", "--check"]);
  expect(utility).not.toHaveBeenCalled();
});

test("a host utility outranks the build fallback and gets only its argument suffix", async () => {
  const build = mock<CommandRoute["run"]>(async () => 1);
  const utility = mock<CommandRoute["run"]>(async () => 2);
  expect(await runPackageCommand({ resolveModelCap: () => ({ cap: null, source: null, environment: "unset" }), argv: ["codex", "trust", "--all"],
    composition: compositionFor([{ verb: [], run: build }, { verb: ["codex", "trust"], run: utility }]) })).toBe(2);
  expect(utility).toHaveBeenCalledWith(["--all"]);
  expect(build).not.toHaveBeenCalled();
});
