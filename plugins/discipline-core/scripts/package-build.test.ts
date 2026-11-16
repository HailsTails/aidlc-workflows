import { describe, expect, it, vi } from "vitest";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import { inMemoryFiles } from "../tests/in-memory-files.ts";
import { recordingBundler } from "../tests/recording-bundler.ts";
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

const LOCK = '{ "lockfileVersion": 1, "packages": { "zod": ["zod@4.4.3", "", {}, "sha512-a"], }, }';

const SOURCE_WITHOUT_ZOD_LICENCE: Readonly<Record<string, string>> = {
  "/package/package.json": DEVELOPMENT_MANIFEST,
  "/package/tsconfig.json": "{}\n",
  "/package/README.md": "# Discipline core\n\n[Rules](rules/CD-15/README.md)\n",
  "/package/LICENSE": "MIT No Attribution\n",
  "/package/bun.lock": LOCK,
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
};

const SOURCE: Readonly<Record<string, string>> = { ...SOURCE_WITHOUT_ZOD_LICENCE, "/deps/zod/LICENSE": "MIT License\n" };

const entryOutput = (request: { readonly source: string; readonly path: string; readonly text: string }): BundledOutput => ({
  path: request.path,
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

const CHECK_COMMAND = entryOutput({
  source: "core/check/check-command.ts",
  path: "core/check/check-command.js",
  text: "#!/usr/bin/env node\nawait run();\n",
});

const PROJECT_COMMAND = entryOutput({
  source: "core/check/project-command.ts",
  path: "core/check/project-command.js",
  text: "#!/usr/bin/env node\nawait project();\n",
});

const RUNNER = entryOutput({ source: "mechanisms/audit/runner/runner.ts", path: "mechanisms/audit/runner/runner.js", text: "export const runner = {};\n" });

const LOOPS = entryOutput({ source: "mechanisms/audit/CD-15/loops.ts", path: "mechanisms/audit/CD-15/loops.js", text: "export const check = {};\n" });

const BUNDLE: Bundle = {
  outputs: [CHECK_COMMAND, PROJECT_COMMAND, RUNNER, LOOPS, CHUNK],
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

const NOTHING_WRITTEN = { "/out/stale.js": "stale\n" };

describe("buildPackage", () => {
  it("bundles the commands, runners and shipped piece modules from a stage holding core's code and core's own installed packages, with each peer external", async () => {
    const files = inMemoryFiles({ initial: SOURCE });
    const recording = recordingBundler({ files, stage: STAGE_SOURCE, bundle: { outcome: "ok", value: BUNDLE } });

    await buildPackage({
      ports: { path: posixPath, fileText: files.fileText, scratch: files.scratch, bundler: recording.bundler },
      packageRoot: "/package",
      outputRoot: "/out",
      dependencies: "/deps",
    });

    expect({
      requests: recording.requests(),
      staged: recording.stagedWhenBundled(),
      left: files.pathsUnder({ folder: STAGE_SOURCE }),
    }).toEqual({
      requests: [
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

    const packaged = await built;

    expect({ packaged, written: files.pathsUnder({ folder: "/out" }) }).toEqual({
      packaged: {
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
      bundler: withOutputs([CHECK_COMMAND, PROJECT_COMMAND, RUNNER, LOOPS, { ...CHUNK, externalImports: ["levn", "typescript"] }]),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: an output imports what is neither bundled, a node: builtin nor a declared peer: chunks/chunk-A.js imports levn",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming an entry whose code was moved into a shared chunk, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: withOutputs([CHECK_COMMAND, PROJECT_COMMAND, { ...RUNNER, inputs: [] }, LOOPS, CHUNK]),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error:
          "FAIL: bundle: an entry would not find the install root from its own module: mechanisms/audit/runner/runner.ts is not emitted with its own code at mechanisms/audit/runner/runner.js",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a bundled package whose version is not the one core's bun lock holds, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/deps/zod/package.json": '{ "name": "zod", "version": "4.4.2", "license": "MIT" }' },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: bundle: a bundled package is not the one bun.lock locks: zod 4.4.2 at node_modules/zod, but the lock holds 4.4.3",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a shipped page that links to a file the package does not ship, writing nothing", async () => {
    const { files, built } = builtWith({
      source: { ...SOURCE, "/package/README.md": "# Discipline core\n\n[Proof](tests/test-fixtures/walkthrough/)\n" },
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: {
        outcome: "failed",
        error: "FAIL: a shipped page links to a file the package does not ship: README.md links to tests/test-fixtures/walkthrough",
      },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails naming a bundled package that ships no licence file, writing nothing", async () => {
    const { files, built } = builtWith({
      source: SOURCE_WITHOUT_ZOD_LICENCE,
      bundler: bundlerReturning({ outcome: "ok", value: BUNDLE }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }) }).toEqual({
      result: { outcome: "failed", error: "FAIL: bundle zod: it ships no licence file to reproduce" },
      written: NOTHING_WRITTEN,
    });
  });

  it("fails with the bundler's detail, writing nothing and leaving no stage behind", async () => {
    const { files, built } = builtWith({
      source: SOURCE,
      bundler: bundlerReturning({ outcome: "failed", error: { kind: "bundle-failed", detail: 'Could not resolve "x"' } }),
    });

    expect({ result: await built, written: files.textsUnder({ folder: "/out" }), staged: files.pathsUnder({ folder: STAGE_SOURCE }) }).toEqual({
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
