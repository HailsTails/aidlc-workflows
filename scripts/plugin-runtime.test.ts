import { describe, expect, mock, test, type Mock } from "bun:test";
import { createPluginRuntimeCompiler, createPluginRuntimeArtifactPort, publishPluginRuntimeArtifacts, createPluginRuntimeSourcePort, preparePluginRuntimeArtifacts, prepareProjectedPluginRuntimeArtifacts, type PluginRuntimePort, type PluginRuntimeSourceFileSystem, type PluginRuntimeSourcePort, type RuntimeCompilerPort, type RuntimeCompilerFactory, type RuntimeArtifactFileSystem, type RuntimeArtifactPort } from "./plugin-runtime.ts";

const source = { file: "tools/guard.ts", source: "fixture" };
const packagePort: PluginRuntimePort = {
  scan: () => ({ imports: ["zod", "./reader.ts"], exports: ["guard"], hasUnsupportedImportMeta: false, hasPackageImports: true }),
  declaration: () => ({ content: "export declare const guard: () => boolean;\n", companions: [] }),
  bundle: async () => "export const guard = () => true;\n",
};

describe("typed plugin runtime packaging", () => {
  test("closes an explicitly selected module without a package import and preserves its filename", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["hooks/guard.ts"], sources: [{ file: "hooks/guard.ts", source: "fixture" }],
      closedModules: ["hooks/guard.ts"], port: { ...packagePort, scan: () => ({
        imports: ["../../../core/tools/observer.ts"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false,
      }) },
    });
    expect(result).toEqual({ kind: "prepared", artifacts: [
      { file: "hooks/guard.ts", content: "export const guard = () => true;\n" },
    ] });
  });

  test("refuses unsupported metadata for a closed dependency-free module", async () => {
    const result = await preparePluginRuntimeArtifacts({
      pluginRoot: "/fixture", files: ["hooks/guard.ts"], sources: [{ file: "hooks/guard.ts", source: "fixture" }],
      closedModules: ["hooks/guard.ts"], port: { ...packagePort, scan: () => ({
        imports: [], exports: [], hasUnsupportedImportMeta: true, hasPackageImports: false,
      }) },
    });
    expect(result).toEqual({ kind: "refused", message: "plugin runtime closure would change import.meta semantics: hooks/guard.ts" });
  });

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

type ProjectedRuntimeFixture = {
  readonly sourcePort: { readonly read: Mock<PluginRuntimeSourcePort["read"]> };
  readonly runtimePort: {
    readonly scan: Mock<RuntimeCompilerPort["scan"]>;
    readonly declaration: Mock<RuntimeCompilerPort["declaration"]>;
    readonly bundle: Mock<RuntimeCompilerPort["bundle"]>;
  };
};

function projectedRuntimeFixture(): ProjectedRuntimeFixture {
  return {
    sourcePort: {
      read: mock<PluginRuntimeSourcePort["read"]>().mockResolvedValue({ kind: "found", source: "fixture" }),
    },
    runtimePort: {
      scan: mock<RuntimeCompilerPort["scan"]>().mockReturnValue({
        imports: ["node:fs", "./reader.ts"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false,
      }),
      declaration: mock<RuntimeCompilerPort["declaration"]>().mockReturnValue({
        content: "export declare const guard: () => boolean;\n", companions: [],
      }),
      bundle: mock<RuntimeCompilerPort["bundle"]>().mockResolvedValue("closed runtime"),
    },
  };
}

test("reads only supported executable extensions, never declarations or unrelated projected files", async () => {
  const fixture = projectedRuntimeFixture();
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [
      "tools/a.ts", "tools/b.cts", "tools/c.mts", "tools/d.js", "tools/e.cjs", "tools/f.mjs",
      "tools/a.d.ts", "tools/b.d.cts", "tools/c.d.mts", "tools/view.tsx", "tools/view.jsx",
      "tools/a.ts.map", "tools/a.TS", "tools/README.md", "hooks/hook.d.ts", "manifest.json",
    ], ...fixture,
  });
  expect(prepared).toEqual({ kind: "prepared", artifacts: [] });
  expect(fixture.sourcePort.read.mock.calls).toEqual([
    [{ pluginRoot: "/plugin", file: "tools/a.ts" }],
    [{ pluginRoot: "/plugin", file: "tools/b.cts" }],
    [{ pluginRoot: "/plugin", file: "tools/c.mts" }],
    [{ pluginRoot: "/plugin", file: "tools/d.js" }],
    [{ pluginRoot: "/plugin", file: "tools/e.cjs" }],
    [{ pluginRoot: "/plugin", file: "tools/f.mjs" }],
  ]);
  expect(fixture.runtimePort.scan).toHaveBeenCalledTimes(6);
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("omits projected files absent from authored storage, including missing closed hooks", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockResolvedValueOnce({ kind: "missing" });
  fixture.sourcePort.read.mockResolvedValueOnce({ kind: "found", source: "present" });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/generated.ts", "tools/reader.ts"], ...fixture,
  });
  expect(prepared).toEqual({ kind: "prepared", artifacts: [] });
  expect(fixture.runtimePort.scan.mock.calls).toEqual([[{ source: "present" }]]);
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("preserves an existing empty source instead of treating it as missing", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockResolvedValue({ kind: "found", source: "" });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/empty.ts"], ...fixture,
  });
  expect(fixture.runtimePort.scan.mock.calls).toEqual([[{ source: "" }]]);
  expect(prepared).toEqual({ kind: "prepared", artifacts: [{ file: "hooks/empty.ts", content: "closed runtime" }] });
});

test("closes only authored ts files beneath hooks, preserving their filenames and nested paths", async () => {
  const fixture = projectedRuntimeFixture();
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [
      "hooks/guard.ts", "hooks/nested/observer.ts", "hooks/guard.cts", "hooks/guard.mts",
      "hooks/guard.js", "hooks/guard.cjs", "hooks/guard.mjs", "tools/guard.ts",
      "hooks-other/guard.ts", "hooks.ts",
    ], ...fixture,
  });
  expect(prepared).toEqual({ kind: "prepared", artifacts: [
    { file: "hooks/guard.ts", content: "closed runtime" },
    { file: "hooks/nested/observer.ts", content: "closed runtime" },
  ] });
  expect(fixture.runtimePort.bundle.mock.calls).toEqual([
    [{ pluginRoot: "/plugin", file: "hooks/guard.ts", relativeImports: [] }],
    [{ pluginRoot: "/plugin", file: "hooks/nested/observer.ts", relativeImports: [] }],
  ]);
  expect(fixture.runtimePort.declaration).not.toHaveBeenCalled();
});

test("keeps package companions for non-closed sources with authored relative imports", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue({
    imports: ["zod", "./reader.ts"], exports: ["default"], hasUnsupportedImportMeta: false, hasPackageImports: true,
  });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.mjs"], ...fixture,
  });
  expect(prepared).toEqual({ kind: "prepared", artifacts: [
    { file: "hooks/guard.mjs", content: 'export * from "./guard.runtime.js";\nexport { default } from "./guard.runtime.js";\n' },
    { file: "hooks/guard.runtime.js", content: "closed runtime" },
    { file: "hooks/guard.runtime.d.ts", content: "export declare const guard: () => boolean;\n" },
  ] });
  expect(fixture.runtimePort.bundle.mock.calls).toEqual([
    [{ pluginRoot: "/plugin", file: "hooks/guard.mjs", relativeImports: ["./reader.ts"] }],
  ]);
});

test("keeps filtered declaration paths in the collision inventory", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue({
    imports: ["zod"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: true,
  });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["tools/guard.ts", "tools/guard.runtime.d.ts"], ...fixture,
  });
  expect(prepared).toEqual({
    kind: "refused", message: "plugin runtime companion collides with projected file: tools/guard.runtime.d.ts",
  });
  expect(fixture.sourcePort.read.mock.calls).toEqual([[{ pluginRoot: "/plugin", file: "tools/guard.ts" }]]);
  expect(fixture.runtimePort.declaration).not.toHaveBeenCalled();
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("refuses unsupported metadata before closing an authored hook", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue({
    imports: [], exports: [], hasUnsupportedImportMeta: true, hasPackageImports: false,
  });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts"], ...fixture,
  });
  expect(prepared).toEqual({
    kind: "refused", message: "plugin runtime closure would change import.meta semantics: hooks/guard.ts",
  });
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
  expect(fixture.runtimePort.declaration).not.toHaveBeenCalled();
});

test("returns no writable artifacts and stops compilation when a later hook is refused", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValueOnce({
    imports: [], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: false,
  });
  fixture.runtimePort.scan.mockReturnValueOnce({
    imports: [], exports: [], hasUnsupportedImportMeta: true, hasPackageImports: false,
  });
  const prepared = await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/first.ts", "hooks/refused.ts", "hooks/later.ts"], ...fixture,
  });
  expect(prepared).toEqual({
    kind: "refused", message: "plugin runtime closure would change import.meta semantics: hooks/refused.ts",
  });
  expect(fixture.sourcePort.read).toHaveBeenCalledTimes(3);
  expect(fixture.runtimePort.scan).toHaveBeenCalledTimes(2);
  expect(fixture.runtimePort.bundle.mock.calls).toEqual([
    [{ pluginRoot: "/plugin", file: "hooks/first.ts", relativeImports: [] }],
  ]);
});

type RuntimeSourceFileSystemFixture = {
  readonly inspect: Mock<PluginRuntimeSourceFileSystem["inspect"]>;
  readonly readText: Mock<PluginRuntimeSourceFileSystem["readText"]>;
};

function runtimeSourceFileSystemFixture(): RuntimeSourceFileSystemFixture {
  return {
    inspect: mock<PluginRuntimeSourceFileSystem["inspect"]>().mockResolvedValue(undefined),
    readText: mock<PluginRuntimeSourceFileSystem["readText"]>().mockResolvedValue(""),
  };
}

test("the source adapter preserves an empty file and binds both storage operations to its path", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: ".", file: "guard.ts" })).toEqual({ kind: "found", source: "" });
  expect(fileSystem.inspect.mock.calls).toEqual([[{ path: "guard.ts" }]]);
  expect(fileSystem.readText.mock.calls).toEqual([[{ path: "guard.ts" }]]);
});

test("the source adapter omits an absent file before reading", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.inspect.mockRejectedValue({ code: "ENOENT", message: "not present" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({ kind: "missing" });
  expect(fileSystem.readText).not.toHaveBeenCalled();
});

test("the source adapter omits a path whose parent is not a directory", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.inspect.mockRejectedValue({ code: "ENOTDIR", message: "parent is not a directory" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({ kind: "missing" });
  expect(fileSystem.readText).not.toHaveBeenCalled();
});

test("the source adapter reports denied inspection instead of treating it as absence", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.inspect.mockRejectedValue({ code: "EACCES", message: "access denied" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-inspection-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EACCES", message: "access denied",
    },
  });
  expect(fileSystem.readText).not.toHaveBeenCalled();
});

test("the source adapter reports a denied read with its file and operation", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue({ code: "EPERM", message: "read denied" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EPERM", message: "read denied",
    },
  });
});

test("the source adapter reports a file disappearing after successful inspection", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue({ code: "ENOENT", message: "disappeared after inspection" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "ENOENT", message: "disappeared after inspection",
    },
  });
});

test("the source adapter reports directory input as a read failure", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue({ code: "EISDIR", message: "source is a directory" });
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EISDIR", message: "source is a directory",
    },
  });
});

test("the source adapter retains an Error message without inventing a platform code", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue(new Error("source unavailable"));
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: null, message: "source unavailable",
    },
  });
});

test("the source adapter describes a non-Error rejection as a tagged storage failure", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue("storage unavailable");
  const sourcePort = createPluginRuntimeSourcePort({ fileSystem });
  expect(await sourcePort.read({ pluginRoot: "/plugin", file: "hooks/guard.ts" })).toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: null, message: "storage unavailable",
    },
  });
});

test("projected runtime preparation returns a source failure before reading later files or compiling", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockResolvedValue({ kind: "unavailable", error: {
    kind: "source-inspection-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EACCES", message: "access denied",
  } });
  const preparation = prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts", "hooks/later.ts"], ...fixture,
  });
  expect(preparation).toBeInstanceOf(Promise);
  expect(await preparation).toEqual({ kind: "unavailable", error: {
    kind: "source-inspection-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EACCES", message: "access denied",
  } });
  expect(fixture.sourcePort.read.mock.calls).toEqual([[{ pluginRoot: "/plugin", file: "hooks/guard.ts" }]]);
  expect(fixture.runtimePort.scan).not.toHaveBeenCalled();
  expect(fixture.runtimePort.declaration).not.toHaveBeenCalled();
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("projected runtime preparation returns no partial artifacts after a later source read fails", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockResolvedValueOnce({ kind: "found", source: "first source" });
  fixture.sourcePort.read.mockResolvedValueOnce({ kind: "unavailable", error: {
    kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/second.ts", code: "ENOENT", message: "source disappeared",
  } });
  expect(await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/first.ts", "hooks/second.ts", "hooks/later.ts"], ...fixture,
  })).toEqual({ kind: "unavailable", error: {
    kind: "source-read-failed", pluginRoot: "/plugin", file: "hooks/second.ts", code: "ENOENT", message: "source disappeared",
  } });
  expect(fixture.sourcePort.read).toHaveBeenCalledTimes(2);
  expect(fixture.runtimePort.scan).not.toHaveBeenCalled();
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("projected runtime preparation captures a rejecting source collaborator separately from storage failures", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockRejectedValue({ code: "EACCES", message: "provider failed" });
  const preparation = prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts", "hooks/later.ts"], ...fixture,
  });
  expect(preparation).toBeInstanceOf(Promise);
  expect(await preparation).toEqual({ kind: "unavailable", error: {
    kind: "source-provider-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: "EACCES", message: "provider failed",
  } });
  expect(fixture.sourcePort.read).toHaveBeenCalledTimes(1);
  expect(fixture.runtimePort.scan).not.toHaveBeenCalled();
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("projected runtime preparation returns a bundle failure separately from source failure", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.bundle.mockRejectedValue(new Error("bundler rejected"));
  const preparation = prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts"], ...fixture,
  });
  expect(await preparation).toEqual({ kind: "unavailable", error: {
    kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", message: "bundler rejected", cause: new Error("bundler rejected"),
  } });
});

test("compiler creation returns a ready injected compiler", async () => {
  const fixture = projectedRuntimeFixture();
  const create = mock<RuntimeCompilerFactory["create"]>().mockResolvedValue(fixture.runtimePort);
  expect(await createPluginRuntimeCompiler({ projectRoot: "/project", factory: { create } })).toEqual({ kind: "ready", port: fixture.runtimePort });
  expect(create.mock.calls).toEqual([[{ projectRoot: "/project" }]]);
});

test("compiler creation returns configuration failure as data", async () => {
  const create = mock<RuntimeCompilerFactory["create"]>().mockRejectedValue(new Error("invalid tsconfig"));
  expect(await createPluginRuntimeCompiler({ projectRoot: "/project", factory: { create } })).toEqual({
    kind: "unavailable", error: { kind: "compiler-configuration-failed", projectRoot: "/project", message: "invalid tsconfig" },
  });
});

test("runtime scan failure stops compilation and identifies the source", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue(Promise.reject(new Error("syntax rejected")));
  expect(await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts", "hooks/later.ts"], ...fixture,
  })).toEqual({ kind: "unavailable", error: {
    kind: "runtime-scan-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", message: "syntax rejected", cause: new Error("syntax rejected"),
  } });
  expect(fixture.runtimePort.scan).toHaveBeenCalledTimes(1);
  expect(fixture.runtimePort.declaration).not.toHaveBeenCalled();
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("runtime declaration failure prevents bundling and returns no artifacts", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue({ imports: ["zod"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: true });
  fixture.runtimePort.declaration.mockReturnValue(Promise.reject(new Error("declaration rejected")));
  expect(await prepareProjectedPluginRuntimeArtifacts({ pluginRoot: "/plugin", files: ["tools/guard.ts"], ...fixture })).toEqual({
    kind: "unavailable", error: { kind: "runtime-declaration-failed", pluginRoot: "/plugin", file: "tools/guard.ts", message: "declaration rejected", cause: new Error("declaration rejected") },
  });
  expect(fixture.runtimePort.bundle).not.toHaveBeenCalled();
});

test("companion bundle failure remains distinct from declaration failure", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue({ imports: ["zod"], exports: [], hasUnsupportedImportMeta: false, hasPackageImports: true });
  fixture.runtimePort.bundle.mockRejectedValue(new Error("dependency unavailable"));
  expect(await prepareProjectedPluginRuntimeArtifacts({ pluginRoot: "/plugin", files: ["tools/guard.ts"], ...fixture })).toEqual({
    kind: "unavailable", error: { kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "tools/guard.ts", message: "dependency unavailable", cause: new Error("dependency unavailable") },
  });
  expect(fixture.runtimePort.declaration).toHaveBeenCalledTimes(1);
});

test("a later compiler failure discards prior prepared artifacts and stops subsequent entries", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.bundle.mockResolvedValueOnce("first runtime");
  fixture.runtimePort.bundle.mockRejectedValueOnce(new Error("second bundle rejected"));
  expect(await prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/first.ts", "hooks/second.ts", "hooks/later.ts"], ...fixture,
  })).toEqual({ kind: "unavailable", error: {
    kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "hooks/second.ts", message: "second bundle rejected", cause: new Error("second bundle rejected"),
  } });
  expect(fixture.runtimePort.scan).toHaveBeenCalledTimes(2);
  expect(fixture.runtimePort.bundle).toHaveBeenCalledTimes(2);
});

test("non-Error compiler rejection retains operation identity", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.scan.mockReturnValue(Promise.reject("scanner unavailable"));
  expect(await prepareProjectedPluginRuntimeArtifacts({ pluginRoot: "/plugin", files: ["hooks/guard.ts"], ...fixture })).toEqual({
    kind: "unavailable", error: { kind: "runtime-scan-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", message: "scanner unavailable", cause: "scanner unavailable" },
  });
});

type RuntimeArtifactFileSystemFixture = {
  readonly createDirectory: Mock<RuntimeArtifactFileSystem["createDirectory"]>;
  readonly writeText: Mock<RuntimeArtifactFileSystem["writeText"]>;
};

function runtimeArtifactFileSystemFixture(): RuntimeArtifactFileSystemFixture {
  return {
    createDirectory: mock<RuntimeArtifactFileSystem["createDirectory"]>().mockResolvedValue(undefined),
    writeText: mock<RuntimeArtifactFileSystem["writeText"]>().mockResolvedValue(undefined),
  };
}

test("the artifact adapter creates the parent and writes exact content", async () => {
  const fileSystem = runtimeArtifactFileSystemFixture();
  const port = createPluginRuntimeArtifactPort({ fileSystem });
  expect(await port.write({ outDir: ".", artifact: { file: "guard.ts", content: "runtime" } })).toEqual({ kind: "written" });
  expect(fileSystem.createDirectory.mock.calls).toEqual([[{ path: "." }]]);
  expect(fileSystem.writeText.mock.calls).toEqual([[{ path: "guard.ts", content: "runtime" }]]);
});

test("the artifact adapter returns a directory creation failure before writing", async () => {
  const fileSystem = runtimeArtifactFileSystemFixture();
  fileSystem.createDirectory.mockRejectedValue(new Error("directory denied"));
  const port = createPluginRuntimeArtifactPort({ fileSystem });
  expect(await port.write({ outDir: "/output", artifact: { file: "guard.ts", content: "runtime" } })).toEqual({
    kind: "unavailable", error: { kind: "artifact-directory-failed", outDir: "/output", file: "guard.ts", message: "directory denied", writtenFiles: [] },
  });
  expect(fileSystem.writeText).not.toHaveBeenCalled();
});

test("the artifact adapter returns write failure with its destination", async () => {
  const fileSystem = runtimeArtifactFileSystemFixture();
  fileSystem.writeText.mockRejectedValue(new Error("disk full"));
  const port = createPluginRuntimeArtifactPort({ fileSystem });
  expect(await port.write({ outDir: "/output", artifact: { file: "guard.ts", content: "runtime" } })).toEqual({
    kind: "unavailable", error: { kind: "artifact-write-failed", outDir: "/output", file: "guard.ts", message: "disk full", writtenFiles: [] },
  });
});

test("publication passes an authored refusal without writing", async () => {
  const write = mock<RuntimeArtifactPort["write"]>().mockResolvedValue({ kind: "written" });
  expect(await publishPluginRuntimeArtifacts({ outDir: "/output", prepared: { kind: "refused", message: "metadata unsupported" }, port: { write } })).toEqual({ kind: "refused", message: "metadata unsupported" });
  expect(write).not.toHaveBeenCalled();
});

test("publication passes compiler unavailability without writing", async () => {
  const write = mock<RuntimeArtifactPort["write"]>().mockResolvedValue({ kind: "written" });
  expect(await publishPluginRuntimeArtifacts({ outDir: "/output", prepared: { kind: "unavailable", error: {
    kind: "runtime-scan-failed", pluginRoot: "/plugin", file: "guard.ts", message: "syntax rejected", cause: new Error("syntax rejected"),
  } }, port: { write } })).toEqual({ kind: "unavailable", error: {
    kind: "runtime-scan-failed", pluginRoot: "/plugin", file: "guard.ts", message: "syntax rejected", cause: new Error("syntax rejected"),
  } });
  expect(write).not.toHaveBeenCalled();
});

test("publication preserves artifact order and exact write requests", async () => {
  const write = mock<RuntimeArtifactPort["write"]>().mockResolvedValue({ kind: "written" });
  expect(await publishPluginRuntimeArtifacts({ outDir: "/output", prepared: { kind: "prepared", artifacts: [
    { file: "first.ts", content: "first" }, { file: "second.ts", content: "second" },
  ] }, port: { write } })).toEqual({ kind: "published", files: ["first.ts", "second.ts"] });
  expect(write.mock.calls).toEqual([
    [{ outDir: "/output", artifact: { file: "first.ts", content: "first" } }],
    [{ outDir: "/output", artifact: { file: "second.ts", content: "second" } }],
  ]);
});

test("publication reports already-written files and stops after a later storage failure", async () => {
  const write = mock<RuntimeArtifactPort["write"]>().mockResolvedValueOnce({ kind: "written" }).mockResolvedValueOnce({
    kind: "unavailable", error: { kind: "artifact-write-failed", outDir: "/output", file: "second.ts", message: "disk full", writtenFiles: [] },
  });
  expect(await publishPluginRuntimeArtifacts({ outDir: "/output", prepared: { kind: "prepared", artifacts: [
    { file: "first.ts", content: "first" }, { file: "second.ts", content: "second" }, { file: "later.ts", content: "later" },
  ] }, port: { write } })).toEqual({ kind: "unavailable", error: {
    kind: "artifact-write-failed", outDir: "/output", file: "second.ts", message: "disk full", writtenFiles: ["first.ts"],
  } });
  expect(write).toHaveBeenCalledTimes(2);
});

test("publication catches a failing provider without throwing", async () => {
  const write = mock<RuntimeArtifactPort["write"]>().mockRejectedValue(new Error("provider failed"));
  expect(await publishPluginRuntimeArtifacts({ outDir: "/output", prepared: { kind: "prepared", artifacts: [
    { file: "guard.ts", content: "runtime" },
  ] }, port: { write } })).toEqual({ kind: "unavailable", error: {
    kind: "artifact-provider-failed", outDir: "/output", file: "guard.ts", message: "provider failed", writtenFiles: [],
  } });
});

test("legacy companion preparation rejects with the original error identity and metadata", async () => {
  const cause = { operation: "read dependency" };
  const failure = Object.assign(new TypeError("dependency rejected", { cause }), { code: "EACCES" });
  const bundle = mock<PluginRuntimePort["bundle"]>().mockRejectedValue(failure);
  const prepared = preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], port: { ...packagePort, bundle },
  });
  await expect(prepared).rejects.toBe(failure);
  await expect(prepared).rejects.toBeInstanceOf(TypeError);
  await expect(prepared).rejects.toMatchObject({ code: "EACCES", cause });
});

test("legacy closed module preparation retains a non-Error rejection value", async () => {
  const failure = { code: "COMPILER_UNAVAILABLE", reason: "fixture" };
  const bundle = mock<PluginRuntimePort["bundle"]>().mockRejectedValue(failure);
  await expect(preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], closedModules: [source.file],
    port: { ...packagePort, bundle },
  })).rejects.toBe(failure);
});

test("legacy preparation retains an undefined rejection value", async () => {
  const bundle = mock<PluginRuntimePort["bundle"]>().mockRejectedValue(undefined);
  await expect(preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], port: { ...packagePort, bundle },
  })).rejects.toBeUndefined();
});

test("legacy preparation preserves a synchronous scanner exception subtype", async () => {
  const bundle = mock<PluginRuntimePort["bundle"]>();
  const scan = mock<PluginRuntimePort["scan"]>(JSON.parse.bind(null, "invalid fixture", undefined));
  await expect(preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], port: { ...packagePort, scan, bundle },
  })).rejects.toBeInstanceOf(SyntaxError);
  expect(bundle).not.toHaveBeenCalled();
});

test("legacy preparation preserves a synchronous declaration exception subtype", async () => {
  const bundle = mock<PluginRuntimePort["bundle"]>();
  const declaration = mock<PluginRuntimePort["declaration"]>(JSON.parse.bind(null, "invalid fixture", undefined));
  await expect(preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], port: { ...packagePort, declaration, bundle },
  })).rejects.toBeInstanceOf(SyntaxError);
  expect(bundle).not.toHaveBeenCalled();
});

test("total preparation retains the original compiler cause inside tagged failure data", async () => {
  const cause = { operation: "read dependency" };
  const failure = Object.assign(new TypeError("dependency rejected", { cause }), { code: "EACCES" });
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.bundle.mockRejectedValue(failure);
  const prepared = prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts"], ...fixture,
  });
  await expect(prepared).resolves.toEqual({ kind: "unavailable", error: {
    kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", message: "dependency rejected", cause: failure,
  } });
});

test("legacy preparation preserves a rejection that cannot be converted to text", async () => {
  const failure = { toString: null, valueOf: null };
  const bundle = mock<PluginRuntimePort["bundle"]>().mockRejectedValue(failure);
  await expect(preparePluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: [source.file], sources: [source], port: { ...packagePort, bundle },
  })).rejects.toBe(failure);
});

test("total preparation keeps an unprintable compiler cause as tagged data", async () => {
  const failure = { toString: null, valueOf: null };
  const fixture = projectedRuntimeFixture();
  fixture.runtimePort.bundle.mockRejectedValue(failure);
  await expect(prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts"], ...fixture,
  })).resolves.toEqual({ kind: "unavailable", error: {
    kind: "runtime-bundle-failed", pluginRoot: "/plugin", file: "hooks/guard.ts",
    message: "Runtime operation failed without a printable message", cause: failure,
  } });
});

test("projected runtime preparation returns an unprintable source provider failure as data", async () => {
  const fixture = projectedRuntimeFixture();
  fixture.sourcePort.read.mockRejectedValue({ toString: null, valueOf: null });
  await expect(prepareProjectedPluginRuntimeArtifacts({
    pluginRoot: "/plugin", files: ["hooks/guard.ts", "hooks/later.ts"], ...fixture,
  })).resolves.toEqual({ kind: "unavailable", error: {
    kind: "source-provider-failed", pluginRoot: "/plugin", file: "hooks/guard.ts", code: null,
    message: "Runtime operation failed without a printable message",
  } });
  expect(fixture.sourcePort.read).toHaveBeenCalledTimes(1);
  expect(fixture.runtimePort.scan).not.toHaveBeenCalled();
});

test("the source adapter retains a platform code on an unprintable inspection failure", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.inspect.mockRejectedValue({ code: "EACCES", toString: null, valueOf: null });
  await expect(createPluginRuntimeSourcePort({ fileSystem }).read({ pluginRoot: "/plugin", file: "guard.ts" })).resolves.toEqual({
    kind: "unavailable", error: {
      kind: "source-inspection-failed", pluginRoot: "/plugin", file: "guard.ts", code: "EACCES",
      message: "Runtime operation failed without a printable message",
    },
  });
  expect(fileSystem.readText).not.toHaveBeenCalled();
});

test("the source adapter returns an unprintable read failure as data", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  fileSystem.readText.mockRejectedValue({ toString: null, valueOf: null });
  await expect(createPluginRuntimeSourcePort({ fileSystem }).read({ pluginRoot: "/plugin", file: "guard.ts" })).resolves.toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "guard.ts", code: null,
      message: "Runtime operation failed without a printable message",
    },
  });
});

test("the source adapter safely handles a failure whose metadata cannot be inspected", async () => {
  const fileSystem = runtimeSourceFileSystemFixture();
  const failure = Object.defineProperty({}, "code", { get: JSON.parse.bind(null, "invalid fixture", undefined) });
  fileSystem.readText.mockRejectedValue(failure);
  await expect(createPluginRuntimeSourcePort({ fileSystem }).read({ pluginRoot: "/plugin", file: "guard.ts" })).resolves.toEqual({
    kind: "unavailable", error: {
      kind: "source-read-failed", pluginRoot: "/plugin", file: "guard.ts", code: null, message: "[object Object]",
    },
  });
});
