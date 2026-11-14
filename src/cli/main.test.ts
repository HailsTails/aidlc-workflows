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
import type { CreatePackageBuildRoot, PackageBuildRoot } from "./roots.ts";
import { openPackageBuildRoot } from "./main.ts";
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
