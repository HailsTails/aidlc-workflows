import type { RuntimeCompilerPort } from "./plugin-runtime.ts";
import { describe, expect, mock, test } from "bun:test";
import { preparePluginDeclarationArtifacts, preparePluginDeclarationRuntime, type PluginDeclarationPort } from "./plugin-declaration.ts";

const packagePort: PluginDeclarationPort = { declaration: () => ({ content: "export declare const guard: () => boolean;\n", companions: [] }) };

describe("declaration-only runtime dependency preparation", () => {
  test("projects an explicit declaration dependency without shipping its executable module", () => {
    expect(preparePluginDeclarationArtifacts({ pluginRoot: "/fixture", file: "projection/guard.ts", files: [], port: packagePort })).toEqual({
      kind: "prepared", artifacts: [{ file: "projection/guard.d.ts", content: "export declare const guard: () => boolean;\n" }],
    });
  });

  test("refuses an occupied declaration before emitting it", () => {
    expect(preparePluginDeclarationArtifacts({ pluginRoot: "/fixture", file: "projection/guard.ts", files: ["projection/guard.d.ts"], port: packagePort })).toEqual({
      kind: "refused", message: "plugin declaration collides with projected file or has no source extension: projection/guard.d.ts",
    });
  });

  test("retains a declaration's vendored type companions", () => {
    expect(preparePluginDeclarationArtifacts({ pluginRoot: "/fixture", file: "projection/guard.ts", files: [], port: {
      ...packagePort, declaration: () => ({ content: "declaration", companions: [{ file: "tools/vendor.d.ts", content: "companion" }] }),
    } })).toEqual({ kind: "prepared", artifacts: [
      { file: "projection/guard.d.ts", content: "declaration" }, { file: "tools/vendor.d.ts", content: "companion" },
    ] });
  });

  test("refuses a declaration companion that would overwrite projected content", () => {
    expect(preparePluginDeclarationArtifacts({ pluginRoot: "/fixture", file: "projection/guard.ts", files: ["tools/vendor.d.ts"], port: {
      ...packagePort, declaration: () => ({ content: "declaration", companions: [{ file: "tools/vendor.d.ts", content: "companion" }] }),
    } })).toEqual({ kind: "refused", message: "plugin declaration companion collides with projected file: tools/vendor.d.ts" });
  });

});

test("total declaration preparation returns a compiler failure as data", async () => {
  const declaration = mock<RuntimeCompilerPort["declaration"]>().mockReturnValue(Promise.reject(new Error("compiler rejected")));
  expect(await preparePluginDeclarationRuntime({ pluginRoot: "/plugin", file: "projection/guard.ts", files: [], port: { declaration } })).toEqual({
    kind: "unavailable", error: { kind: "runtime-declaration-failed", pluginRoot: "/plugin", file: "projection/guard.ts", message: "compiler rejected", cause: new Error("compiler rejected") },
  });
});

test("total declaration preparation preserves collision refusal before invoking the compiler", async () => {
  const declaration = mock<RuntimeCompilerPort["declaration"]>();
  expect(await preparePluginDeclarationRuntime({ pluginRoot: "/plugin", file: "projection/guard.ts", files: ["projection/guard.d.ts"], port: { declaration } })).toEqual({
    kind: "refused", message: "plugin declaration collides with projected file or has no source extension: projection/guard.d.ts",
  });
  expect(declaration).not.toHaveBeenCalled();
});

test("total declaration preparation preserves successful artifacts", async () => {
  const declaration = mock<RuntimeCompilerPort["declaration"]>().mockReturnValue({ content: "declaration", companions: [{ file: "vendor.d.ts", content: "companion" }] });
  expect(await preparePluginDeclarationRuntime({ pluginRoot: "/plugin", file: "projection/guard.ts", files: [], port: { declaration } })).toEqual({
    kind: "prepared", artifacts: [{ file: "projection/guard.d.ts", content: "declaration" }, { file: "vendor.d.ts", content: "companion" }],
  });
});
