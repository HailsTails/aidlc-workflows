import { HOSTS } from "./host-table.ts";
const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import { hash } from "../kernel/fixtures/values.fixture.ts";
import type { ContentDigester } from "../kernel/content-digester-port.ts";
import type { CreatePackageBuildRoot, PackageBuildRoot } from "./roots.ts";
import { openPackageBuildRoot } from "./main.ts";

const fileSystem = createInMemoryFileSystem({ files: {} });
const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
const yaml = createInMemoryYamlParser({ documents: {} });
const digester: ContentDigester = { hash: () => accepted(hash("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")) };
const root: PackageBuildRoot = {
  settingsCapabilities: { extendedSubprocessTimeoutMs: 1, hookTrust: () => "unused" },
  projectHost: mock<PackageBuildRoot["projectHost"]>(),
  readHostDistribution: mock<PackageBuildRoot["readHostDistribution"]>(),
  buildPayload: mock<PackageBuildRoot["buildPayload"]>(),
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
  const createPackageBuildRoot = mock<CreatePackageBuildRoot>(() => root);
  expect(openPackageBuildRoot({ createNodeFileSystem, createNodeProcessRunner,
    createBunYamlParser, createBunContentDigester, createPackageBuildRoot, outliner })).toBe(root);
  expect(createNodeFileSystem).toHaveBeenCalledTimes(1);
  expect(createNodeProcessRunner).toHaveBeenCalledTimes(1);
  expect(createBunYamlParser).toHaveBeenCalledTimes(1);
  expect(createBunContentDigester).toHaveBeenCalledTimes(1);
  expect(createPackageBuildRoot).toHaveBeenCalledTimes(1);
  expect(createPackageBuildRoot).toHaveBeenCalledWith({ hosts: HOSTS, outliner,
    platform: { fileSystem, processRunner, yaml, digester },
    sources: { core: new URL("../../core/", import.meta.url), plugins: new URL("../../plugins/", import.meta.url) },
    runnerFrames: new URL("../../.cache/runner-frames/", import.meta.url),
  });
});
