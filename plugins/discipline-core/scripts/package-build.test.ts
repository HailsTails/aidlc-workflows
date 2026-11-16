import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import { type InMemoryFiles, inMemoryFiles } from "../tests/in-memory-files.ts";
import type { Bundle, BundledOutput, BundleFailure, BundlerPort } from "./esbuild-bundler-port.ts";
import { buildPackage } from "./package-build.ts";

const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/" });

const STAGE_SOURCE = "/tmp/discipline-core-package-stage-1/source";

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

const LOCK = JSON.stringify({ lockfileVersion: 3, packages: { "": { version: "0.0.0" }, "node_modules/zod": { version: "4.4.3" } } });

const SOURCE: Readonly<Record<string, string>> = {
  "/package/package.json": DEVELOPMENT_MANIFEST,
  "/package/tsconfig.json": "{}\n",
  "/package/README.md": "# Discipline core\n\n[Rules](rules/CD-15/README.md)\n",
  "/package/LICENSE": "MIT No Attribution\n",
  "/package/install/package-lock.json": LOCK,
  "/package/core/check/check-command.ts": "await run();\n",
  "/package/core/check/project-command.ts": "await project();\n",
  "/package/core/check/run-check.test.ts": "test\n",
  "/package/core/tests/helper.ts": "export const helper = 1;\n",
  "/package/mechanisms/audit/runner/runner.ts": "export const runner = {};\n",
  "/package/mechanisms/audit/CD-15/piece.json": '{ "version": 1, "clauses": [ { "clause": "loops", "settings": { "module": "loops.ts" } } ] }',
  "/package/mechanisms/audit/CD-15/loops.ts": "export const check = {};\n",
  "/package/rules/CD-15/discipline.json": '{ "version": 1 }\n',
  "/package/rules/CD-15/README.md": "# CD-15\n",
  "/package/docs/why-chain-contract.md": "# Why-chain contract\n",
  "/deps/zod/package.json": '{ "name": "zod", "version": "4.4.3", "license": "MIT" }',
  "/deps/zod/LICENSE": "MIT License\n",
};

const entryOutput = (request: { readonly source: string; readonly text: string }): BundledOutput => ({
  path: request.source.replace(/\.ts$/, ".js"),
  text: request.text,
  entryPoint: request.source,
  inputs: [request.source],
  externalImports: ["node:fs"],
});

const CHUNK: BundledOutput = {
  path: "chunks/chunk-A.js",
  text: "export {};\n",
  entryPoint: undefined,
  inputs: ["node_modules/zod/index.js"],
  externalImports: ["typescript", "eslint/use-at-your-own-risk"],
};

const BUNDLE: Bundle = {
  outputs: [
    entryOutput({ source: "core/check/check-command.ts", text: "#!/usr/bin/env node\nawait run();\n" }),
    entryOutput({ source: "core/check/project-command.ts", text: "#!/usr/bin/env node\nawait project();\n" }),
    entryOutput({ source: "mechanisms/audit/runner/runner.ts", text: "export const runner = {};\n" }),
    entryOutput({ source: "mechanisms/audit/CD-15/loops.ts", text: "export const check = {};\n" }),
    CHUNK,
  ],
  packageRoots: ["node_modules/zod"],
};

const bundlerReturning = (bundle: Result<Bundle, BundleFailure>): BundlerPort => ({
  bundle: vi.fn<BundlerPort["bundle"]>().mockResolvedValue(bundle),
});

const withOutputs = (outputs: readonly BundledOutput[]): BundlerPort => bundlerReturning({ outcome: "ok", value: { ...BUNDLE, outputs } });

const builtWith = (request: { readonly source: Readonly<Record<string, string>>; readonly bundler: BundlerPort }) => {
  const files = inMemoryFiles({ initial: { ...request.source, "/out/stale.js": "stale\n" } });
  return {
    files,
    built: buildPackage({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: request.bundler },
      packageRoot: "/package",
      outputRoot: "/out",
      dependencies: "/deps",
    }),
  };
};

const outputOf = (request: { readonly texts: Readonly<Record<string, string>> }): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(request.texts).filter(([path]) => path.startsWith("/out/")));

const stagedPaths = (request: { readonly files: InMemoryFiles }): readonly string[] =>
  Object.keys(request.files.texts())
    .filter((path) => path.startsWith(`${STAGE_SOURCE}/`))
    .map((path) => path.slice(STAGE_SOURCE.length + 1))
    .sort();

const NOTHING_WRITTEN = { "/out/stale.js": "stale\n" };

describe("buildPackage", () => {
  it("bundles the commands, runners and shipped piece modules from a stage holding core's code and core's own installed packages, with each peer external", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const seen: { staged: readonly string[] } = { staged: [] };
    const bundler: BundlerPort = {
      bundle: vi.fn<BundlerPort["bundle"]>().mockImplementation(() => {
        seen.staged = stagedPaths({ files });
        return Promise.resolve({ outcome: "ok", value: BUNDLE });
      }),
    };

    await buildPackage({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler },
      packageRoot: "/package",
      outputRoot: "/out",
      dependencies: "/deps",
    });

    expect({ calls: vi.mocked(bundler.bundle).mock.calls, staged: seen.staged, left: stagedPaths({ files }) }).toEqual({
      calls: [
        [
          {
            sourceRoot: STAGE_SOURCE,
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
      ],
      staged: [
        "core/check/check-command.ts",
        "core/check/project-command.ts",
        "mechanisms/audit/CD-15/loops.ts",
        "mechanisms/audit/CD-15/piece.json",
        "mechanisms/audit/runner/runner.ts",
        "node_modules/zod/LICENSE",
        "node_modules/zod/package.json",
        "package.json",
        "tsconfig.json",
      ],
      left: [],
    });
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
            "core/check/project-command.js",
            "docs/why-chain-contract.md",
            "mechanisms/audit/CD-15/loops.js",
            "mechanisms/audit/CD-15/piece.json",
            "mechanisms/audit/runner/runner.js",
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
        "/out/core/check/project-command.js",
        "/out/docs/why-chain-contract.md",
        "/out/mechanisms/audit/CD-15/loops.js",
        "/out/mechanisms/audit/CD-15/piece.json",
        "/out/mechanisms/audit/runner/runner.js",
        "/out/package.json",
        "/out/rules/CD-15/README.md",
        "/out/rules/CD-15/discipline.json",
      ],
    });
  });

  it("writes the published manifest naming every top-level entry, the built piece naming its .js module, and the bundled package's licence", async () => {
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

  it("fails naming each output that imports a package it neither bundles nor declares as a peer, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: withOutputs([...BUNDLE.outputs.slice(0, 4), { ...CHUNK, externalImports: ["levn", "typescript"] }]),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: an output imports what is neither bundled, a node: builtin nor a declared peer: chunks/chunk-A.js imports levn",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming an entry whose code was moved into a shared chunk, writing nothing", async () => {
    const [checkCommand, projectCommand, runner, loops] = BUNDLE.outputs;
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: withOutputs([checkCommand, projectCommand, { ...runner, inputs: [] }, loops, CHUNK]),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: {
        outcome: "failed",
        error:
          "FAIL: bundle: an entry would not find the install root from its own module: mechanisms/audit/runner/runner.ts is not emitted with its own code at mechanisms/audit/runner/runner.js",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a bundled package whose version is not the one core's install lock holds, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/deps/zod/package.json": '{ "name": "zod", "version": "4.4.2", "license": "MIT" }' },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: a bundled package is not the one install/package-lock.json locks: zod 4.4.2 at node_modules/zod, but the lock holds 4.4.3",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a shipped page that links to a file the package does not ship, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/README.md": "# Discipline core\n\n[Proof](tests/test-fixtures/walkthrough/)\n" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: a shipped page links to a file the package does not ship: README.md links to tests/test-fixtures/walkthrough",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a bundled package that ships no licence file, writing nothing", async () => {
    const { files, built } = builtWith({
      source: Object.fromEntries(Object.entries(SOURCE).filter(([path]) => path !== "/deps/zod/LICENSE")),
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }) }).toEqual({
      result: { outcome: "failed", error: "FAIL: bundle zod: it ships no licence file to reproduce" },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails with the bundler's detail, writing nothing and leaving no stage behind", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: bundlerReturning({ outcome: "failed", error: { kind: "bundle-failed", detail: 'Could not resolve "x"' } }),
    });

    expect({ result: await built, written: outputOf({ texts: files.texts() }), staged: stagedPaths({ files }) }).toEqual({
      result: { outcome: "failed", error: 'FAIL: bundle: Could not resolve "x"' },
      written: NOTHING_WRITTEN,
      staged: [],
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
