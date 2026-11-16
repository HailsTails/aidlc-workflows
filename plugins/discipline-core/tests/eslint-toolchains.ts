import { assert } from "vitest";
import type { EmbeddedRunner } from "../core/mechanism-port/embedded-runner-module-schema.ts";
import { toolchainBoundEmbeddedRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import { createEslintPort, type EslintPort, type EslintToolchain } from "../mechanisms/eslint/runner/eslint-instance.ts";
import {
  defaultEslintToolchainModules,
  type EslintToolchainModules,
  loadEslintToolchain,
} from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import { eslint9PieceModules, eslint9ToolchainModules } from "./test-fixtures/eslint-9/eslint-9-toolchain.ts";

export type EslintLine = "eslint-10" | "eslint-9";

export const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-9"];

const RUNNER_MODULE_SUFFIX = "mechanisms/eslint/runner/runner.ts";

export const toolchainModulesOn = (request: { readonly line: EslintLine }): EslintToolchainModules => {
  switch (request.line) {
    case "eslint-10":
      return defaultEslintToolchainModules;
    case "eslint-9":
      return eslint9ToolchainModules;
  }
};

export const loadedEslintToolchain = async (request: { readonly line: EslintLine }): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ modules: toolchainModulesOn(request) });
  assert(loaded.outcome === "ok", `the ${request.line} toolchain loads from the development install`);
  return loaded.value;
};

export const eslintPortOn = async (request: { readonly line: EslintLine }): Promise<EslintPort> =>
  createEslintPort({ toolchain: await loadedEslintToolchain(request) });

export const pieceModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort => {
  switch (request.line) {
    case "eslint-10":
      return request.base;
    case "eslint-9":
      return eslint9PieceModules({ base: request.base });
  }
};

export const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadEslintToolchain({ modules: toolchainModulesOn(request) }),
    projectedKinds: ESLINT_PROJECTED_KINDS,
    runnerOf: (toolchain) =>
      createEslintRunner({
        fileText: createDefaultFileTextPort({}),
        modules: pieceModulesOn({ line: request.line, base: createDefaultModuleLoaderPort({}) }),
        path: createDefaultPathPort({}),
        eslint: createEslintPort({ toolchain }),
      }),
  });

export const runnerModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort => {
  const runner = eslintRunnerOn({ line: request.line });
  return {
    load: (load) =>
      load.path.replaceAll("\\", "/").endsWith(RUNNER_MODULE_SUFFIX)
        ? Promise.resolve({ outcome: "ok", value: { runner } })
        : request.base.load(load),
  };
};

export const defaultEslintPort: EslintPort = await eslintPortOn({ line: "eslint-10" });
