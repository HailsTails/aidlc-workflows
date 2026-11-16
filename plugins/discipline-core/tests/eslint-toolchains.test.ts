import { describe, expect, it, vi } from "vitest";
import type { ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { defaultEslintToolchainPeers } from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import {
  ESLINT_LINES,
  eslintPeersOn,
  eslintRunnerOn,
  loadedEslintToolchain,
  modulesServingRunner,
  pieceModulesOn,
} from "./eslint-toolchains.ts";

const SERVED_RUNNER = { exceptionPath: "standalone" };

const BASE_MODULE = { outcome: "ok", value: { base: "module" } } as const;

const baseLoader = (): ModuleLoaderPort => ({ load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue(BASE_MODULE) });

describe("the ESLint lines of the development install", () => {
  it("lists ESLint 10 and 9, each at the version core compiles against and at its floor", () => {
    expect(ESLINT_LINES).toEqual(["eslint-10", "eslint-10-floor", "eslint-9", "eslint-9-floor"]);
  });

  it.each([
    { line: "eslint-10", version: /^10\./ },
    { line: "eslint-10-floor", version: /^10\.0\.0$/ },
    { line: "eslint-9", version: /^9\./ },
    { line: "eslint-9-floor", version: /^9\.12\.0$/ },
  ] as const)("loads the $line toolchain at its own ESLint version", async ({ line, version }) => {
    expect((await loadedEslintToolchain({ line })).eslintVersion).toMatch(version);
  });

  it("locates each line's peers the way core does", () => {
    expect(eslintPeersOn({ line: "eslint-9-floor" }).location).toBe(defaultEslintToolchainPeers.location);
  });

  it("builds the embedded ESLint runner over a line", () => {
    expect(eslintRunnerOn({ line: "eslint-9-floor" })).toMatchObject({ exceptionPath: "embedded" });
  });
});

describe("modulesServingRunner", () => {
  it("serves the given runner for a path ending in the runner suffix, whatever its separators", async () => {
    const base = baseLoader();
    const modules = modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: SERVED_RUNNER, base });
    expect(await modules.load({ path: "C:\\install\\mechanisms\\eslint\\runner\\runner.ts" })).toEqual({
      outcome: "ok",
      value: { runner: SERVED_RUNNER },
    });
    expect(base.load).not.toHaveBeenCalled();
  });

  it("hands any other path to the base loader", async () => {
    const base = baseLoader();
    const modules = modulesServingRunner({ runnerSuffix: "/runner/runner.ts", runner: SERVED_RUNNER, base });
    expect(await modules.load({ path: "/install/mechanisms/eslint/CD-6/cd6/cd6.eslint-plugin.ts" })).toEqual(BASE_MODULE);
  });
});

describe("pieceModulesOn", () => {
  it("builds a piece that wraps native rules from the line's own rules", async () => {
    const base: ModuleLoaderPort = {
      load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
        outcome: "ok",
        value: { createPlugin: vi.fn<(sources: object) => object>().mockReturnValue({ rules: { wrapped: {} } }) },
      }),
    };
    expect(await pieceModulesOn({ line: "eslint-9-floor", base }).load({ path: "/install/piece.ts" })).toEqual({
      outcome: "ok",
      value: { default: { rules: { wrapped: {} } } },
    });
  });

  it("passes a piece without createPlugin through unchanged", async () => {
    expect(await pieceModulesOn({ line: "eslint-9-floor", base: baseLoader() }).load({ path: "/install/piece.ts" })).toEqual(
      BASE_MODULE,
    );
  });
});
