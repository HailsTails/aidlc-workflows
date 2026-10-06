import { describe, expect, test } from "bun:test";
import { preparePluginRuntimeArtifacts, type PluginRuntimePort } from "./plugin-runtime.ts";

const source = { file: "tools/guard.ts", source: "fixture" };
const packagePort: PluginRuntimePort = {
  scan: () => ({ imports: ["zod", "./reader.ts"], exports: ["guard"], hasUnsupportedImportMeta: false, hasPackageImports: true }),
  declaration: () => ({ content: "export declare const guard: () => boolean;\n", companions: [] }),
  bundle: async () => "export const guard = () => true;\n",
};

describe("typed plugin runtime packaging", () => {
  test("keeps the authored import path and adds runtime and declaration companions", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source], port: packagePort,
    });
    expect(result).toEqual({ kind: "prepared", artifacts: [
      { file: "tools/guard.ts", content: 'export * from "./guard.runtime.js";\n' },
      { file: "tools/guard.runtime.js", content: "export const guard = () => true;\n" },
      { file: "tools/guard.runtime.d.ts", content: "export declare const guard: () => boolean;\n" },
    ] });
  });

  test("preserves a default export in the original import path", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source],
      port: { ...packagePort, scan: () => ({
        imports: ["zod"], exports: ["default"], hasUnsupportedImportMeta: false, hasPackageImports: true,
      }) },
    });
    expect(result).toEqual({ kind: "prepared", artifacts: [
      { file: "tools/guard.ts", content: 'export * from "./guard.runtime.js";\nexport { default } from "./guard.runtime.js";\n' },
      { file: "tools/guard.runtime.js", content: "export const guard = () => true;\n" },
      { file: "tools/guard.runtime.d.ts", content: "export declare const guard: () => boolean;\n" },
    ] });
  });

  test("leaves dependency-free runtime sources unchanged", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source],
      port: { ...packagePort, scan: () => ({
        imports: ["node:fs", "./reader.ts"], exports: ["guard"], hasUnsupportedImportMeta: false, hasPackageImports: false,
      }) },
    });
    expect(result).toEqual({ kind: "prepared", artifacts: [] });
  });

  test("refuses an authored runtime companion collision before invoking the compiler", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts", "tools/guard.runtime.js"], sources: [source],
      port: { ...packagePort, declaration: () => { throw new Error("compiler must not run"); } },
    });
    expect(result).toEqual({ kind: "refused", message: "plugin runtime companion collides with projected file: tools/guard.runtime.js" });
  });

  test("refuses an authored declaration companion collision", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts", "tools/guard.runtime.d.ts"], sources: [source], port: packagePort,
    });
    expect(result).toEqual({ kind: "refused", message: "plugin runtime companion collides with projected file: tools/guard.runtime.d.ts" });
  });

  test("refuses collisions between generated companions for two source extensions", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts", "tools/guard.js"],
      sources: [source, { file: "tools/guard.js", source: "second fixture" }], port: packagePort,
    });
    expect(result).toEqual({ kind: "refused", message: "plugin runtime companion collides with projected file: tools/guard.runtime.js" });
  });

  test("refuses entry-relative semantics instead of silently changing them", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source],
      port: { ...packagePort, scan: () => ({
        imports: ["zod"], exports: ["guard"], hasUnsupportedImportMeta: true, hasPackageImports: true,
      }) },
    });
    expect(result).toEqual({ kind: "refused", message: "plugin runtime companion would change import.meta semantics: tools/guard.ts" });
  });

  test("passes only authored relative imports to dependency bundling", async () => {
    const requests: unknown[] = [];
    await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source],
      port: { ...packagePort, bundle: async (request) => { requests.push(request); return "runtime"; } },
    });
    expect(requests).toEqual([{ pluginRoot: "/fixture", file: "tools/guard.ts", relativeImports: ["./reader.ts"] }]);
  });

  test("propagates a compiler failure before returning writable artifacts", async () => {
    const result = preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["tools/guard.ts"], sources: [source],
      port: { ...packagePort, declaration: () => { throw new Error("declaration rejected"); } },
    });
    await expect(result).rejects.toThrow("declaration rejected");
  });
});
