import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../core/check/run-check.ts";
import { loadFailureText } from "../core/check/load-failure-text.ts";
import { toolchainBoundEmbeddedRunner, toolchainBoundStandaloneRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../core/platform-ports/git-port.ts";
import type { PackageLocationPort } from "../core/platform-ports/package-location-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../core/values/repo-path.ts";
import { createWalkerRunner } from "../mechanisms/audit/runner/create-walker-runner.ts";
import { defaultTypeScriptModules, loadParsePort } from "../mechanisms/audit/runner/typescript-parse.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createEslintPort } from "../mechanisms/eslint/runner/eslint-instance.ts";
import { loadEslintToolchain } from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import { eslintPeersOn, modulesServingRunner } from "./eslint-toolchains.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const notInstalled = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from ${INSTALL_ROOT}/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
});

const pieceLoads = (): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>(),
});

const unresolvedFirst = (request: { readonly packageName: string }): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: vi.fn<PackageLocationPort["locate"]>().mockThrow(notInstalled(request)),
});

const shadowedEslint: PackageLocationPort = {
  installRoot: INSTALL_ROOT,
  installForm: "package",
  locate: (locate) => ({ outcome: "ok", value: `${INSTALL_ROOT}/node_modules/${locate.packageName}/lib/api.js` }),
};

const eslintRunnerLocatingBy = (request: { readonly pieces: ModuleLoaderPort; readonly location: PackageLocationPort }) =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadEslintToolchain({ peers: { ...eslintPeersOn({ line: "eslint-10" }), location: request.location } }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({ fileText, modules: request.pieces, path, eslint: createEslintPort({ toolchain }), moduleExtension: ".ts" }),
  });

const auditRunnerWithoutTypescript = (request: { readonly pieces: ModuleLoaderPort }) =>
  toolchainBoundStandaloneRunner({
    toolchain: loadParsePort({ peers: { modules: defaultTypeScriptModules, location: unresolvedFirst({ packageName: "typescript" }) } }),
    runnerOf: (parse) => createWalkerRunner({ fileText, modules: request.pieces, path, parse }),
  });

const checkWith = (request: { readonly fixture: string; readonly runner: unknown; readonly tracked: readonly RepoPath[] }) =>
  runCheck({
    repoRoot: absolutePathSchema.parse(`${INSTALL_ROOT}/${request.fixture}`),
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    baseRevision: undefined,
    fileText,
    modules: modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: request.runner, base: createDefaultModuleLoaderPort({}) }),
    path,
    git: gitTracking({ tracked: request.tracked }),
  });

describe("a check whose adopter has not installed a toolchain peer the selected mechanism needs", () => {
  it("fails the ESLint mechanism as toolchain-unavailable naming eslint and its supported range, before loading any piece", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "tests/test-fixtures/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces, location: unresolvedFirst({ packageName: "eslint" }) }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    expect({ checked, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      checked: {
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "eslint",
          failure: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: "not installed" },
        },
      },
      pieceLoads: [],
    });
  });

  it("prints that failure as one load-failure line telling the adopter what to add, never a stack trace", async () => {
    const checked = await checkWith({
      fixture: "tests/test-fixtures/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces: pieceLoads(), location: unresolvedFirst({ packageName: "eslint" }) }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    assert(checked.outcome === "failed", "the check fails to load");
    expect(loadFailureText({ failure: checked.error })).toBe(
      "load failure: runner-failed eslint toolchain-unavailable eslint found not installed, supported ^9.12.0 || ^10.0.0: add a supported version to the devDependencies of the repository root\n",
    );
  });

  it("fails the audit mechanism as toolchain-unavailable naming typescript, before loading any piece", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "tests/test-fixtures/consumer-proof/audit",
      runner: auditRunnerWithoutTypescript({ pieces }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    expect({ checked, pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      checked: {
        outcome: "failed",
        error: {
          kind: "runner-failed",
          mechanism: "audit",
          failure: { kind: "toolchain-unavailable", packageName: "typescript", supported: ">=4.8.4 <7.0.0", found: "not installed" },
        },
      },
      pieceLoads: [],
    });
  });

  it("fails the ESLint mechanism as toolchain-shadowed when eslint resolves from inside the core install, and prints what to delete", async () => {
    const pieces = pieceLoads();
    const checked = await checkWith({
      fixture: "tests/test-fixtures/consumer-proof/eslint",
      runner: eslintRunnerLocatingBy({ pieces, location: shadowedEslint }),
      tracked: [repoPathSchema.parse("src/plain.ts")],
    });
    assert(checked.outcome === "failed", "the check fails to load");
    expect({ printed: loadFailureText({ failure: checked.error }), pieceLoads: vi.mocked(pieces.load).mock.calls }).toEqual({
      printed: `load failure: runner-failed eslint toolchain-shadowed eslint resolved from ${INSTALL_ROOT}/node_modules/eslint/lib/api.js inside the core install ${INSTALL_ROOT}: delete ${INSTALL_ROOT}/node_modules, then reinstall core, a copied folder with npm ci inside it or the package with the repository's package manager, so the repository's own copy is used\n`,
      pieceLoads: [],
    });
  });
});
