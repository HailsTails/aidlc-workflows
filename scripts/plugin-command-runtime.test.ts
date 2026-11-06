import { expect, mock, test } from "bun:test";
import { prepareProjectedPluginRuntimeArtifacts, type PluginRuntimeSourcePort, type RuntimeCompilerPort } from "./plugin-runtime.ts";

test("closes an admitted command with no inferred package or hook authority", async () => {
  const read = mock<PluginRuntimeSourcePort["read"]>().mockResolvedValue({ kind: "found", source: "fixture" });
  const scan = mock<RuntimeCompilerPort["scan"]>().mockReturnValue({ imports: ["../../../core/tools/config.ts"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false });
  const declaration = mock<RuntimeCompilerPort["declaration"]>().mockReturnValue({ content: "unused", companions: [] });
  const bundle = mock<RuntimeCompilerPort["bundle"]>().mockResolvedValue("closed command");
  expect(await prepareProjectedPluginRuntimeArtifacts({ pluginRoot: "/plugin", files: ["tools/run.ts"], closedModules: ["tools/run.ts"], sourcePort: { read }, runtimePort: { scan, declaration, bundle } })).toEqual({ kind: "prepared", artifacts: [{ file: "tools/run.ts", content: "closed command" }] });
  expect(read.mock.calls).toEqual([[{ pluginRoot: "/plugin", file: "tools/run.ts" }]]);
  expect(bundle.mock.calls).toEqual([[{ pluginRoot: "/plugin", file: "tools/run.ts", relativeImports: [] }]]);
  expect(declaration).not.toHaveBeenCalled();
});

test("refuses a projected command whose authored source is absent before compilation", async () => {
  const read = mock<PluginRuntimeSourcePort["read"]>().mockResolvedValue({ kind: "missing" });
  const scan = mock<RuntimeCompilerPort["scan"]>().mockReturnValue({ imports: [], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false });
  const declaration = mock<RuntimeCompilerPort["declaration"]>().mockReturnValue({ content: "unused", companions: [] });
  const bundle = mock<RuntimeCompilerPort["bundle"]>().mockResolvedValue("unused");
  expect(await prepareProjectedPluginRuntimeArtifacts({ pluginRoot: "/plugin", files: ["tools/run.ts"], closedModules: ["tools/run.ts"], sourcePort: { read }, runtimePort: { scan, declaration, bundle } })).toEqual({ kind: "refused", message: "declared plugin command source is missing: tools/run.ts" });
  expect(scan).not.toHaveBeenCalled();
  expect(bundle).not.toHaveBeenCalled();
});
