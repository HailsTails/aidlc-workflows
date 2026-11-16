import { describe, expect, it, vi } from "vitest";
import type { PackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import { ESLINT_LINES, eslintPeersOn } from "../../../tests/eslint-toolchains.ts";
import type { EslintClass, EslintModule } from "./eslint-instance.ts";
import { type EslintToolchainModules, type EslintToolchainPeers, loadEslintToolchain } from "./eslint-toolchain.ts";

type EslintConstructor = new (...options: ConstructorParameters<EslintClass>) => InstanceType<EslintClass>;

const REAL_10 = eslintPeersOn({ line: "eslint-10" });

const INSTALL_ROOT = "/repo/tools/discipline-core";

const REPOSITORY_LOCATION = "/repo/node_modules/package/index.js";

const notInstalled = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from ${INSTALL_ROOT}/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });

const withEslintVersion = (request: { readonly version: string }): EslintToolchainPeers => ({
  ...REAL_10,
  modules: {
    ...REAL_10.modules,
    eslint: (): Promise<EslintModule> =>
      Promise.resolve({ ESLint: Object.assign(vi.fn<EslintConstructor>(), { version: request.version }) }),
  },
});

const locatedBy = (locate: PackageLocationPort["locate"]): EslintToolchainPeers => ({
  ...REAL_10,
  location: { installRoot: INSTALL_ROOT, locate },
});

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
    const locate = vi.fn<PackageLocationPort["locate"]>().mockReturnValue(REPOSITORY_LOCATION);
    await loadEslintToolchain({ peers: locatedBy(locate) });
    expect(locate.mock.calls).toEqual([
      [{ packageName: "eslint" }],
      [{ packageName: "@typescript-eslint/parser" }],
      [{ packageName: "@typescript-eslint/eslint-plugin" }],
    ]);
  });
});

describe("loadEslintToolchain when a peer is missing, unsupported or shadowed", () => {
  it("names eslint as not installed, with the supported range, when it does not resolve", async () => {
    const locate = vi.fn<PackageLocationPort["locate"]>().mockThrow(notInstalled({ packageName: "eslint" }));
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
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

  it("names @typescript-eslint/parser as not installed when it does not resolve", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrow(notInstalled({ packageName: "@typescript-eslint/parser" }));
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "@typescript-eslint/parser", supported: "^8.56.0", found: "not installed" },
    });
  });

  it("names @typescript-eslint/eslint-plugin as not installed when it does not resolve", async () => {
    const locate = vi
      .fn<PackageLocationPort["locate"]>()
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockReturnValueOnce(REPOSITORY_LOCATION)
      .mockThrow(notInstalled({ packageName: "@typescript-eslint/eslint-plugin" }));
    await expect(loadEslintToolchain({ peers: locatedBy(locate) })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "toolchain-unavailable",
        packageName: "@typescript-eslint/eslint-plugin",
        supported: "^8.56.0",
        found: "not installed",
      },
    });
  });

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
