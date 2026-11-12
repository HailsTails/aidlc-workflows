import { describe, expect, test } from "bun:test";
import { IMPLEMENTERS, registeredGlobalRoots, type Implementer } from "./implementers.ts";

const RUNTIME_GLOBALS: Implementer = {
  capability: "sample",
  file: "src/kernel/sample.ts",
  port: "src/kernel/sample-port.ts",
  modules: [],
  globals: ["Bun.spawn", "Bun.YAML", "process.execPath"],
  factory: "createSample",
  fakeSeam: "src/kernel/fixtures/sample.fake.ts",
  hermeticTest: "src/kernel/sample.hermetic.test.ts",
};

describe("IMPLEMENTERS", () => {
  test("the platform capabilities each have one implementer with its seams named", () => {
    expect(IMPLEMENTERS).toMatchObject([
      {
        capability: "file-system",
        file: "src/kernel/file-system.ts",
        port: "src/kernel/file-system-port.ts",
        factory: "createNodeFileSystem",
        fakeSeam: "src/kernel/fixtures/file-system.fake.ts",
        hermeticTest: "src/kernel/file-system.hermetic.test.ts",
      },
      {
        capability: "process-runner",
        factory: "createNodeProcessRunner",
        hermeticTest: "src/kernel/process-runner.hermetic.test.ts",
      },
      {
        capability: "yaml-parser",
        factory: "createBunYamlParser",
        hermeticTest: "src/kernel/yaml-parser.hermetic.test.ts",
      },
      {
        capability: "content-digester",
        factory: "createBunContentDigester",
        hermeticTest: "src/kernel/content-digester.hermetic.test.ts",
      },
      {
        capability: "tool-bundler",
        file: "src/packaging/adapters/bun-tool-bundler.ts",
        port: "src/packaging/application/ports.ts",
        globals: ["Bun.build", "Bun.fileURLToPath"],
        factory: "createBunToolBundler",
        fakeSeam: "src/packaging/fixtures/tool-bundler.fake.ts",
        hermeticTest: "src/packaging/adapters/bun-tool-bundler.hermetic.test.ts",
      },
    ]);
  });
});

describe("registeredGlobalRoots", () => {
  test("it reduces each registered global to the name lint restricts", () => {
    expect(registeredGlobalRoots(RUNTIME_GLOBALS)).toEqual(["Bun", "Bun", "process"]);
  });

  test("an implementer with no registered global has no root", () => {
    expect(registeredGlobalRoots({ ...RUNTIME_GLOBALS, globals: [] })).toEqual([]);
  });
});
