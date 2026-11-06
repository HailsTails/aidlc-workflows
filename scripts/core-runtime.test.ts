import { expect, mock, test, type Mock } from "bun:test";
import { prepareCoreRuntimeArtifacts, type CoreRuntimePreparationOperations } from "./core-runtime.ts";
import type { PluginRuntimeSourcePort, RuntimeCompilerPort, ProjectedPluginRuntime } from "./plugin-runtime.ts";

type CoreRuntimeFixture = {
  readonly operations: { readonly declare: Mock<CoreRuntimePreparationOperations["declare"]>; readonly prepare: Mock<CoreRuntimePreparationOperations["prepare"]> };
  readonly sourcePort: PluginRuntimeSourcePort;
  readonly runtimePort: RuntimeCompilerPort;
};
const fixture = (): CoreRuntimeFixture => ({
  operations: {
    declare: mock<CoreRuntimePreparationOperations["declare"]>().mockResolvedValue({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }] }),
    prepare: mock<CoreRuntimePreparationOperations["prepare"]>().mockResolvedValue({ kind: "prepared", artifacts: [{ file: "hooks/guard.ts", content: "compiled guard" }, { file: "tools/check.runtime.js", content: "runtime" }] }),
  },
  sourcePort: { read: mock<PluginRuntimeSourcePort["read"]>().mockResolvedValue({ kind: "missing" }) },
  runtimePort: {
    scan: mock<RuntimeCompilerPort["scan"]>().mockReturnValue({ imports: [], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false }),
    declaration: mock<RuntimeCompilerPort["declaration"]>().mockReturnValue({ content: "unused", companions: [] }),
    bundle: mock<RuntimeCompilerPort["bundle"]>().mockResolvedValue("unused"),
  },
});

test("prepares the Core declaration and runtime closure together with exact dependency requests", async () => {
  const dependencies = fixture();
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts", "hooks/guard.ts"], ...dependencies })).toEqual({ kind: "prepared", artifacts: [
    { file: "projection/plugin-hook-types.d.ts", content: "declaration" },
    { file: "hooks/guard.ts", content: "compiled guard" },
    { file: "tools/check.runtime.js", content: "runtime" },
  ] });
  expect(dependencies.operations.declare.mock.calls).toEqual([[{ pluginRoot: "/source/core", file: "projection/plugin-hook-types.ts", files: ["tools/check.ts", "hooks/guard.ts"], port: dependencies.runtimePort }]]);
  expect(dependencies.operations.prepare.mock.calls).toEqual([[{ pluginRoot: "/source/core", files: ["tools/check.ts", "hooks/guard.ts", "projection/plugin-hook-types.d.ts"], sourcePort: dependencies.sourcePort, runtimePort: dependencies.runtimePort }]]);
});

test("declaration companions become runtime occupancy before compilation", async () => {
  const dependencies = fixture();
  dependencies.operations.declare.mockResolvedValue({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }, { file: "tools/core-runtime-types/package.json", content: "package" }] });
  dependencies.operations.prepare.mockResolvedValue({ kind: "prepared", artifacts: [] });
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }, { file: "tools/core-runtime-types/package.json", content: "package" }] });
  expect(dependencies.operations.prepare.mock.calls).toEqual([[{ pluginRoot: "/source/core", files: ["tools/check.ts", "projection/plugin-hook-types.d.ts", "tools/core-runtime-types/package.json"], sourcePort: dependencies.sourcePort, runtimePort: dependencies.runtimePort }]]);
});

const declarationFailures: Exclude<ProjectedPluginRuntime, { readonly kind: "prepared" }>[] = [
  { kind: "refused", message: "declaration collision" },
  { kind: "unavailable", error: { kind: "runtime-declaration-failed", pluginRoot: "/source/core", file: "projection/plugin-hook-types.ts", cause: null, message: "compiler unavailable" } },
];
test.each(declarationFailures)("declaration failure suppresses runtime preparation: $kind", async (failure) => {
  const dependencies = fixture();
  dependencies.operations.declare.mockResolvedValue(failure);
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual(failure);
  expect(dependencies.operations.prepare.mock.calls).toEqual([]);
});

const runtimeFailures: Exclude<ProjectedPluginRuntime, { readonly kind: "prepared" }>[] = [
  { kind: "refused", message: "runtime collision" },
  { kind: "unavailable", error: { kind: "runtime-bundle-failed", pluginRoot: "/source/core", file: "hooks/guard.ts", cause: null, message: "bundle unavailable" } },
];
test.each(runtimeFailures)("runtime failure produces no partially prepared declaration result: $kind", async (failure) => {
  const dependencies = fixture();
  dependencies.operations.prepare.mockResolvedValue(failure);
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual(failure);
});

test("identical shared artifacts are retained once", async () => {
  const dependencies = fixture();
  dependencies.operations.prepare.mockResolvedValue({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }, { file: "tools/extra.d.ts", content: "extra" }] });
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }, { file: "tools/extra.d.ts", content: "extra" }] });
});

test("different content cannot override a declaration artifact", async () => {
  const dependencies = fixture();
  dependencies.operations.prepare.mockResolvedValue({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "override" }] });
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual({ kind: "refused", message: "core runtime artifact collision: projection/plugin-hook-types.d.ts" });
});

test("same basename at a different destination is a legitimate separate product", async () => {
  const dependencies = fixture();
  dependencies.operations.prepare.mockResolvedValue({ kind: "prepared", artifacts: [{ file: "tools/plugin-hook-types.d.ts", content: "separate" }] });
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual({ kind: "prepared", artifacts: [{ file: "projection/plugin-hook-types.d.ts", content: "declaration" }, { file: "tools/plugin-hook-types.d.ts", content: "separate" }] });
});

test("conflicting duplicates within runtime artifacts cannot bypass collision admission", async () => {
  const dependencies = fixture();
  dependencies.operations.prepare.mockResolvedValue({ kind: "prepared", artifacts: [{ file: "tools/check.runtime.js", content: "first" }, { file: "tools/check.runtime.js", content: "second" }] });
  expect(await prepareCoreRuntimeArtifacts({ pluginRoot: "/source/core", files: ["tools/check.ts"], ...dependencies })).toEqual({ kind: "refused", message: "core runtime artifact collision: tools/check.runtime.js" });
});
