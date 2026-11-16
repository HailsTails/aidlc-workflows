import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import { inMemoryFiles } from "../tests/in-memory-files.ts";
import type { Bundle, BundleFailure, BundlerPort } from "./esbuild-bundler-port.ts";
import { buildPackage } from "./package-build.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const DEVELOPMENT_MANIFEST = JSON.stringify({
  version: "0.0.0",
  private: true,
  type: "module",
  description: "Runs disciplines.",
  license: "MIT-0",
  engines: { node: ">=22.18.0" },
  dependencies: { zod: "4.4.3" },
  peerDependencies: { eslint: "^9.12.0 || ^10.0.0", typescript: ">=4.8.4 <7.0.0" },
  peerDependenciesMeta: { eslint: { optional: true }, typescript: { optional: true } },
  devDependencies: { esbuild: "0.25.12" },
});

const SOURCE: Readonly<Record<string, string>> = {
  "/package/package.json": DEVELOPMENT_MANIFEST,
  "/package/README.md": "# Discipline core\n",
  "/package/LICENSE": "MIT No Attribution\n",
  "/package/core/check/check-command.ts": "await run();\n",
  "/package/core/check/project-command.ts": "await project();\n",
  "/package/core/check/run-check.test.ts": "test\n",
  "/package/mechanisms/audit/runner/runner.ts": "export const runner = {};\n",
  "/package/mechanisms/audit/CD-15/piece.json": '{ "version": 1, "clauses": [ { "clause": "loops", "settings": { "module": "loops.ts" } } ] }',
  "/package/mechanisms/audit/CD-15/loops.ts": "export const check = {};\n",
  "/package/rules/CD-15/discipline.json": '{ "version": 1 }\n',
  "/package/rules/CD-15/README.md": "# CD-15\n",
  "/package/docs/why-chain-contract.md": "# Why-chain contract\n",
  "/node_modules/zod/package.json": '{ "name": "zod", "version": "4.4.3", "license": "MIT" }',
  "/node_modules/zod/LICENSE": "MIT License\n",
};

const SOURCE_WITHOUT_ZOD_LICENSE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SOURCE).filter(([path]) => path !== "/node_modules/zod/LICENSE"),
);

const BUNDLE: Bundle = {
  files: [
    { path: "core/check/check-command.js", text: "#!/usr/bin/env node\nawait run();\n" },
    { path: "chunks/chunk-A.js", text: "export {};\n" },
  ],
  packageRoots: ["/node_modules/zod"],
};

const bundlerReturning = (bundle: Result<Bundle, BundleFailure>): BundlerPort => ({
  bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue(bundle),
});

const builtWith = (request: { readonly source: Readonly<Record<string, string>>; readonly bundler: BundlerPort }) => {
  const files = inMemoryFiles({ initial: { ...request.source, "/out/stale.js": "stale\n" } });
  return {
    files,
    built: buildPackage({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: request.bundler },
      packageRoot: "/package",
      outputRoot: "/out",
    }),
  };
};

const outputOf = (request: { readonly texts: Readonly<Record<string, string>> }): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.texts).filter(([path]) => path.startsWith("/out/")));

describe("buildPackage", () => {
  it("bundles the commands, runners and shipped piece modules with each peer and its subpaths external, for the shipped Node floor", async () => {
    const bundler = bundlerReturning({ outcome: "ok", value: BUNDLE });

    await builtWith({ source: SOURCE, bundler }).built;

    expect(vi.mocked(bundler.bundle).mock.calls).toEqual([
      [
        {
          packageRoot: "/package",
          entryPoints: [
            "core/check/check-command.ts",
            "core/check/project-command.ts",
            "mechanisms/audit/runner/runner.ts",
            "mechanisms/audit/CD-15/loops.ts",
          ],
          external: ["eslint", "eslint/*", "typescript", "typescript/*"],
          target: "node22.13",
        },
      ],
    ]);
  });

  it("replaces the output root with the bundle, the shipped documents and data, the built pieces, the notices and the published manifest", async () => {
    const { files, built } = builtWith({ source: SOURCE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    const result = await built;

    expect({ result, written: Object.keys(outputOf({ texts: files.texts() })).sort() }).toEqual({
      result: {
        outcome: "ok",
        value: {
          outputRoot: "/out",
          files: [
            "LICENSE",
            "README.md",
            "THIRD-PARTY-NOTICES.md",
            "chunks/chunk-A.js",
            "core/check/check-command.js",
            "docs/why-chain-contract.md",
            "mechanisms/audit/CD-15/piece.json",
            "package.json",
            "rules/CD-15/README.md",
            "rules/CD-15/discipline.json",
          ],
        },
      },
      written: [
        "/out/LICENSE",
        "/out/README.md",
        "/out/THIRD-PARTY-NOTICES.md",
        "/out/chunks/chunk-A.js",
        "/out/core/check/check-command.js",
        "/out/docs/why-chain-contract.md",
        "/out/mechanisms/audit/CD-15/piece.json",
        "/out/package.json",
        "/out/rules/CD-15/README.md",
        "/out/rules/CD-15/discipline.json",
      ],
    });
  });

  it("writes the published manifest naming the bins and every top-level entry, and the built piece naming its .js module", async () => {
    const { files, built } = builtWith({ source: SOURCE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    await built;

    expect(files.texts()).toMatchObject({
      "/out/package.json": expect.stringContaining(
        '"files": [\n    "LICENSE",\n    "README.md",\n    "THIRD-PARTY-NOTICES.md",\n    "chunks",\n    "core",\n    "docs",\n    "mechanisms",\n    "rules"\n  ]',
      ),
      "/out/mechanisms/audit/CD-15/piece.json": expect.stringContaining('"module": "loops.js"'),
      "/out/THIRD-PARTY-NOTICES.md": expect.stringContaining("## zod 4.4.3\n\nLicense: MIT\n\n```text\nMIT License\n```"),
    });
  });

  it("fails naming a bundled package that ships no licence file, writing nothing", async () => {
    const { files, built } = builtWith({ source: SOURCE_WITHOUT_ZOD_LICENSE, bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }) });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: { outcome: "failed", error: "FAIL: bundle zod: it ships no licence file to reproduce" },
      written: { "/out/stale.js": "stale\n" },
    });
  });

  it("fails with the bundler's detail, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: bundlerReturning({ outcome: "failed", error: { kind: "bundle-failed", detail: "Could not resolve \"x\"" } }),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: { outcome: "failed", error: 'FAIL: bundle: Could not resolve "x"' },
      written: { "/out/stale.js": "stale\n" },
    });
  });

  it("fails naming a shipped piece.json that is not JSON", async () => {
    const { built } = builtWith({
      source: { ...SOURCE, "/package/mechanisms/audit/CD-15/piece.json": "{ clauses" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect(await built).toMatchObject({ outcome: "failed", error: expect.stringContaining("FAIL: plan mechanisms/audit/CD-15/piece.json:") });
  });
});
