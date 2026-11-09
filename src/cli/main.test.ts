const outliner = { outline: (text: string) => ({ text, headings: [] }) };
import { expect, mock, test } from "bun:test";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../kernel/fixtures/process-runner.fake.ts";
import { createInMemoryYamlParser } from "../kernel/fixtures/yaml-parser.fake.ts";
import { refused } from "../kernel/result.ts";
import type { CreatePackageBuildRoot, PackageBuildRoot } from "./roots.ts";
import { openPackageBuildRoot } from "./main.ts";

const fileSystem = createInMemoryFileSystem({ files: {} });
const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Unused" }) });
const yaml = createInMemoryYamlParser({ documents: {} });
const root: PackageBuildRoot = {
  projectSkills: mock<PackageBuildRoot["projectSkills"]>(),
  projectAgents: mock<PackageBuildRoot["projectAgents"]>(),
  loadCore: mock<PackageBuildRoot["loadCore"]>(),
  loadPlugins: mock<PackageBuildRoot["loadPlugins"]>(),
  prepareCommandSource: mock<PackageBuildRoot["prepareCommandSource"]>(),
  readHostSources: mock<PackageBuildRoot["readHostSources"]>(),
};

test("the entry constructs each implementer once and binds its instance to the correct root port", () => {
  const createNodeFileSystem = mock(() => fileSystem);
  const createNodeProcessRunner = mock(() => processRunner);
  const createBunYamlParser = mock(() => yaml);
  const createPackageBuildRoot = mock<CreatePackageBuildRoot>(() => root);
  expect(openPackageBuildRoot({ createNodeFileSystem, createNodeProcessRunner,
    createBunYamlParser, createPackageBuildRoot, outliner })).toBe(root);
  expect(createNodeFileSystem).toHaveBeenCalledTimes(1);
  expect(createNodeProcessRunner).toHaveBeenCalledTimes(1);
  expect(createBunYamlParser).toHaveBeenCalledTimes(1);
  expect(createPackageBuildRoot).toHaveBeenCalledTimes(1);
  expect(createPackageBuildRoot).toHaveBeenCalledWith({ outliner, platform: { fileSystem, processRunner, yaml },
    sources: { core: new URL("../../core/", import.meta.url), plugins: new URL("../../plugins/", import.meta.url) },
    runnerFrames: new URL("../../.cache/runner-frames/", import.meta.url),
  });
});
