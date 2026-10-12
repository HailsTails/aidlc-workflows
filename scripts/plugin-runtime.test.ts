import { describe, expect, test } from "bun:test";
import ts from "typescript";
import { emitEntryDeclaration, preparePluginRuntimeArtifacts, type PluginRuntimePort } from "./plugin-runtime.ts";

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

function declarationProgram(files: Readonly<Record<string, string>>, roots: string[], currentDirectory: string) {
  const options: ts.CompilerOptions = { noLib: true, declaration: true, emitDeclarationOnly: true };
  const host: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => files[fileName] === undefined
      ? undefined : ts.createSourceFile(fileName, files[fileName], languageVersion),
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => {},
    getCurrentDirectory: () => currentDirectory,
    getDirectories: () => [],
    fileExists: (fileName) => files[fileName] !== undefined,
    readFile: (fileName) => files[fileName],
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
  };
  return ts.createProgram(roots, options, host);
}

describe("entry declaration compiler identity", () => {
  test("matches a Windows entry whose compiler filename uses forward slashes", () => {
    const path = "H:\\fixture\\entry.ts";
    const program = declarationProgram({ "H:/fixture/entry.ts": "export const entry = 1;" }, [path], "H:/fixture");
    expect(program.getSourceFile(path)?.fileName).toBe("H:/fixture/entry.ts");
    expect(emitEntryDeclaration(program, path).declaration).toContain("entry = 1");
  });

  test("matches a POSIX absolute entry", () => {
    const path = "/fixture/entry.ts";
    const program = declarationProgram({ [path]: "export const entry = 1;" }, [path], "/fixture");
    expect(emitEntryDeclaration(program, path).declaration).toContain("entry = 1");
  });

  test("resolves a relative entry through the compiler current directory", () => {
    const program = declarationProgram({ "entry.ts": "export const entry = 1;" }, ["entry.ts"], "/fixture");
    expect(emitEntryDeclaration(program, "entry.ts").declaration).toContain("entry = 1");
  });

  test("does not capture a distinct file emitted after the entry", () => {
    const files = { "/fixture/entry.ts": "export const entry = 1;", "/fixture/other.ts": "export const other = 2;" };
    const program = declarationProgram(files, Object.keys(files), "/fixture");
    const result = emitEntryDeclaration(program, "/fixture/entry.ts");
    expect(result.declaration).toContain("entry = 1");
    expect(result.declaration).not.toContain("other");
  });

  test("preserves distinct case-sensitive compiler identities", () => {
    const files = { "/fixture/entry.ts": "export const lower = 1;", "/fixture/Entry.ts": "export const upper = 2;" };
    const program = declarationProgram(files, Object.keys(files), "/fixture");
    expect(emitEntryDeclaration(program, "/fixture/entry.ts").declaration).toContain("lower = 1");
    expect(emitEntryDeclaration(program, "/fixture/Entry.ts").declaration).toContain("upper = 2");
  });

  test("does not borrow a declaration when the requested entry is absent", () => {
    const program = declarationProgram({ "/fixture/other.ts": "export const other = 2;" }, ["/fixture/other.ts"], "/fixture");
    expect(emitEntryDeclaration(program, "/fixture/missing.ts").declaration).toBeUndefined();
  });
});
