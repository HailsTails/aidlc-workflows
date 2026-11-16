import { describe, expect, it, vi } from "vitest";
import { toolchainModulesOn } from "../../../tests/eslint-toolchains.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import {
  type EslintClass,
  type EslintModule,
  type EslintToolchainModules,
  eslintOptionsOf,
  loadEslintToolchain,
} from "./eslint-toolchain.ts";

type EslintConstructor = new (...options: ConstructorParameters<EslintClass>) => InstanceType<EslintClass>;

const REAL_10 = toolchainModulesOn({ line: "eslint-10" });

const notInstalled = (request: { readonly packageName: string }): Error =>
  Object.assign(new Error(`Cannot find package '${request.packageName}' imported from /repo/tools/discipline-core/x.ts`), {
    code: "ERR_MODULE_NOT_FOUND",
  });

const withEslintVersion = (request: { readonly version: string }): EslintToolchainModules => ({
  ...REAL_10,
  eslint: (): Promise<EslintModule> =>
    Promise.resolve({ ESLint: Object.assign(vi.fn<EslintConstructor>(), { version: request.version }) }),
});

const CWD = absolutePathSchema.parse("/repo");

describe("loadEslintToolchain over the development install", () => {
  it.each(["eslint-10", "eslint-9"] as const)("loads the %s toolchain", async (line) => {
    await expect(loadEslintToolchain({ modules: toolchainModulesOn({ line }) })).resolves.toMatchObject({
      outcome: "ok",
      value: { createEslint: expect.any(Function), typescriptParser: expect.objectContaining({ parseForESLint: expect.any(Function) }) },
    });
  });
});

describe("loadEslintToolchain when a peer is missing or unsupported", () => {
  it("names eslint as not installed, with the supported range, when it does not resolve", async () => {
    await expect(
      loadEslintToolchain({
        modules: { ...REAL_10, eslint: () => Promise.reject(notInstalled({ packageName: "eslint" })) },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.39.5 || ^10.11.0", found: "not installed" },
    });
  });

  it("names the installed eslint when it is outside the supported range", async () => {
    await expect(loadEslintToolchain({ modules: withEslintVersion({ version: "8.57.1" }) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "eslint", supported: "^9.39.5 || ^10.11.0", found: "8.57.1" },
    });
  });

  it("names typescript first when it is missing, before the parser that needs it can fail on it", async () => {
    const typescriptParser = vi.fn<EslintToolchainModules["typescriptParser"]>();
    await expect(
      loadEslintToolchain({
        modules: { ...REAL_10, typescript: () => Promise.reject(notInstalled({ packageName: "typescript" })), typescriptParser },
      }),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName: "typescript", supported: "~6.0.3", found: "not installed" },
    });
    expect(typescriptParser).not.toHaveBeenCalled();
  });

  it.each([
    { packageName: "@typescript-eslint/parser", modules: { ...REAL_10, typescriptParser: () => Promise.reject(notInstalled({ packageName: "@typescript-eslint/parser" })) } },
    {
      packageName: "@typescript-eslint/eslint-plugin",
      modules: { ...REAL_10, typescriptEslintPlugin: () => Promise.reject(notInstalled({ packageName: "@typescript-eslint/eslint-plugin" })) },
    },
  ])("names $packageName as not installed when it does not resolve", async ({ packageName, modules }) => {
    await expect(loadEslintToolchain({ modules })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "toolchain-unavailable", packageName, supported: "^8.71.2", found: "not installed" },
    });
  });
});

describe("eslintOptionsOf, which speaks ESLint 10's options to either line", () => {
  it("passes the options through unchanged on ESLint 10, the explicit suppressions setting included", () => {
    expect(
      eslintOptionsOf({
        dialect: "eslint-10",
        options: { cwd: CWD, overrideConfigFile: true, ignore: false, applySuppressions: false, allowInlineConfig: false },
      }),
    ).toEqual({ cwd: CWD, overrideConfigFile: true, ignore: false, applySuppressions: false, allowInlineConfig: false });
  });

  it("asks ESLint 10 for nothing extra to look up the configuration nearest each file", () => {
    expect(eslintOptionsOf({ dialect: "eslint-10", options: { cwd: CWD } })).toEqual({ cwd: CWD });
  });

  it("asks ESLint 9 for the nearest-to-file lookup by its flag when no configuration file is named", () => {
    expect(eslintOptionsOf({ dialect: "eslint-9", options: { cwd: CWD } })).toEqual({
      cwd: CWD,
      flags: ["v10_config_lookup_from_file"],
    });
  });

  it("names no lookup flag for ESLint 9 when a configuration file is named", () => {
    expect(eslintOptionsOf({ dialect: "eslint-9", options: { cwd: CWD, overrideConfigFile: "/repo/eslint.config.mjs" } })).toEqual({
      cwd: CWD,
      overrideConfigFile: "/repo/eslint.config.mjs",
    });
  });

  it("leaves the suppressions setting out on ESLint 9, whose API never applies suppressions and refuses the option", () => {
    expect(
      eslintOptionsOf({
        dialect: "eslint-9",
        options: { cwd: CWD, overrideConfigFile: true, ignore: false, applySuppressions: false, allowInlineConfig: false },
      }),
    ).toEqual({ cwd: CWD, overrideConfigFile: true, ignore: false, allowInlineConfig: false });
  });
});
