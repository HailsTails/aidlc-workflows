import { describe, expect, it, vi } from "vitest";
import { ESLINT_LINES, eslintPeersOn } from "../../../tests/eslint-toolchains.ts";
import type { PackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import {
  type EslintClass,
  type EslintModule,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  eslintOptionsOf,
  loadEslintToolchain,
} from "./eslint-toolchain.ts";

type EslintConstructor = new (...options: ConstructorParameters<EslintClass>) => InstanceType<EslintClass>;

const REAL_10 = eslintPeersOn({ line: "eslint-10" });

const INSTALL_ROOT = "/repo/tools/discipline-core";

const notInstalled = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from ${INSTALL_ROOT}/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });

const withModules = (modules: Partial<EslintToolchainModules>): EslintToolchainPeers => ({
  ...REAL_10,
  modules: { ...REAL_10.modules, ...modules },
});

const withEslintVersion = (request: { readonly version: string }): EslintToolchainPeers =>
  withModules({
    eslint: (): Promise<EslintModule> =>
      Promise.resolve({ ESLint: Object.assign(vi.fn<EslintConstructor>(), { version: request.version }) }),
  });

const unresolvedAs = (request: { readonly packageName: string }): PackageLocationPort => ({
  installRoot: INSTALL_ROOT,
  locate: (locate) => {
    if (locate.packageName === request.packageName) {
      throw notInstalled(request);
    }
    return `/repo/node_modules/${locate.packageName}/index.js`;
  },
});

const CWD = absolutePathSchema.parse("/repo");

describe("loadEslintToolchain over the development install", () => {
  it.each(ESLINT_LINES)("loads the %s toolchain and names the ESLint version it loaded", async (line) => {
    await expect(loadEslintToolchain({ peers: eslintPeersOn({ line }) })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        eslintVersion: expect.stringMatching(/^(9|10)\./),
        createEslint: expect.any(Function),
        typescriptParser: expect.objectContaining({ parseForESLint: expect.any(Function) }),
      },
    });
  });

  it("asks where eslint, the parser and the plugin resolve, and never typescript, which the parser bounds", async () => {
    const locate = vi.fn<PackageLocationPort["locate"]>((request) => `/repo/node_modules/${request.packageName}/index.js`);
    await loadEslintToolchain({ peers: { ...REAL_10, location: { installRoot: INSTALL_ROOT, locate } } });
    expect(vi.mocked(locate).mock.calls.map(([request]) => request.packageName)).toEqual([
      "eslint",
      "@typescript-eslint/parser",
      "@typescript-eslint/eslint-plugin",
    ]);
  });
});

describe("loadEslintToolchain when a peer is missing, unsupported or shadowed", () => {
  it("names eslint as not installed, with the supported range, when it does not resolve", async () => {
    await expect(
      loadEslintToolchain({ peers: { ...REAL_10, location: unresolvedAs({ packageName: "eslint" }) } }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: "not installed" },
    });
  });

  it.each(["8.57.1", "9.11.1", "11.0.0"])("names the installed eslint %s as outside the supported range", async (version) => {
    await expect(loadEslintToolchain({ peers: withEslintVersion({ version }) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.12.0 || ^10.0.0", found: version },
    });
  });

  it.each(["@typescript-eslint/parser", "@typescript-eslint/eslint-plugin"])(
    "names %s as not installed when it does not resolve",
    async (packageName) => {
      await expect(loadEslintToolchain({ peers: { ...REAL_10, location: unresolvedAs({ packageName }) } })).resolves.toEqual({
        outcome: "failed",
        error: { kind: "toolchain-unavailable", packageName, supported: "^8.56.0", found: "not installed" },
      });
    },
  );

  it("names eslint as shadowed when it resolves from inside the core install, and never loads it", async () => {
    const eslint = vi.fn<EslintToolchainModules["eslint"]>();
    await expect(
      loadEslintToolchain({
        peers: {
          location: { installRoot: INSTALL_ROOT, locate: () => `${INSTALL_ROOT}/node_modules/eslint/lib/api.js` },
          modules: { ...REAL_10.modules, eslint },
        },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-shadowed",
        packageName: "eslint",
        location: `${INSTALL_ROOT}/node_modules/eslint/lib/api.js`,
        installRoot: INSTALL_ROOT,
      },
    });
    expect(eslint).not.toHaveBeenCalled();
  });
});

describe("eslintOptionsOf, which asks every supported ESLint for the configuration nearest each file", () => {
  it.each(["10.0.0", "10.11.0"])("passes the options through unchanged on ESLint %s, whose default is the nearest-to-file lookup", (version) => {
    expect(eslintOptionsOf({ version, options: { cwd: CWD } })).toEqual({ cwd: CWD });
  });

  it.each(["9.30.0", "9.39.5"])("asks ESLint %s for the lookup by its v10 flag, which these releases name", (version) => {
    expect(eslintOptionsOf({ version, options: { cwd: CWD } })).toEqual({ cwd: CWD, flags: ["v10_config_lookup_from_file"] });
  });

  it.each(["9.12.0", "9.29.0"])("asks ESLint %s for the lookup by its unstable flag, the only name these releases accept", (version) => {
    expect(eslintOptionsOf({ version, options: { cwd: CWD } })).toEqual({ cwd: CWD, flags: ["unstable_config_lookup_from_file"] });
  });

  it.each(["9.12.0", "9.39.5", "10.11.0"])("names no lookup flag for ESLint %s when a configuration file is named", (version) => {
    expect(
      eslintOptionsOf({
        version,
        options: { cwd: CWD, overrideConfigFile: true, ignore: false, allowInlineConfig: false },
      }),
    ).toEqual({ cwd: CWD, overrideConfigFile: true, ignore: false, allowInlineConfig: false });
  });
});
