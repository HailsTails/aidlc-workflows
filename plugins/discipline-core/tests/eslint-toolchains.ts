import { assert } from "vitest";
import { z } from "zod";
import type { EmbeddedRunner } from "../core/mechanism-port/embedded-runner-module-schema.ts";
import type { RunnerFailure } from "../core/mechanism-port/runner-failure.ts";
import { toolchainBoundEmbeddedRunner } from "../core/mechanism-port/toolchain-bound-runner.ts";
import { createDefaultFileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createDefaultModuleLoaderPort, type ModuleLoaderPort } from "../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../core/platform-ports/path-port.ts";
import type { Result } from "../core/values/result.ts";
import { createEslintRunner, ESLINT_PROJECTED_KINDS } from "../mechanisms/eslint/runner/create-eslint-runner.ts";
import {
  createEslintPort,
  type EslintPort,
  type EslintToolchain,
  type TypescriptParser,
} from "../mechanisms/eslint/runner/eslint-instance.ts";
import {
  defaultEslintToolchainPeers,
  type EslintClass,
  type EslintToolchainModules,
  type EslintToolchainPeers,
  loadEslintToolchain,
} from "../mechanisms/eslint/runner/eslint-toolchain.ts";
import { defaultNativeRuleSources, type NativeRuleSources } from "../mechanisms/eslint/runner/native-rules.ts";

export type EslintLine = "eslint-10" | "eslint-10-floor" | "eslint-9" | "eslint-9-floor";

export const ESLINT_LINES: readonly EslintLine[] = ["eslint-10", "eslint-10-floor", "eslint-9", "eslint-9-floor"];

type LineDefinition = {
  readonly eslintVersion: RegExp;
  readonly modules: EslintToolchainModules;
  readonly nativeRuleSources: () => Promise<NativeRuleSources>;
};

const RUNNER_MODULE_SUFFIX = "mechanisms/eslint/runner/runner.ts";

const exportOf = (request: { readonly value: unknown; readonly name: string; readonly type: "function" | "string" }): boolean =>
  (typeof request.value === "object" || typeof request.value === "function") &&
  request.value !== null &&
  typeof Reflect.get(request.value, request.name) === request.type;

const floorEslintSchema = z.object({
  ESLint: z.custom<EslintClass>((value) => typeof value === "function" && exportOf({ value, name: "version", type: "string" })),
});

const floorParserSchema = z.custom<TypescriptParser>(
  (value) =>
    exportOf({ value, name: "parseForESLint", type: "function" }) && exportOf({ value, name: "version", type: "string" }),
);

const floorPluginSchema = z.object({
  default: z.object({ meta: z.object({ name: z.string(), namespace: z.string(), version: z.string() }) }),
});

const floorTypescriptEslintModules = {
  typescriptParser: () => import("typescript-eslint-parser-floor").then((parser) => floorParserSchema.parse(parser)),
  typescriptEslintPlugin: () => import("typescript-eslint-plugin-floor").then((plugin) => floorPluginSchema.parse(plugin)),
};

const floorTypescriptEslintRules = (): Promise<NativeRuleSources["typescriptEslint"]> =>
  import("typescript-eslint-plugin-floor").then((plugin) => plugin.default.rules);

const LINES: Readonly<Record<EslintLine, LineDefinition>> = {
  "eslint-10": {
    eslintVersion: /^10\./,
    modules: defaultEslintToolchainPeers.modules,
    nativeRuleSources: () => Promise.resolve(defaultNativeRuleSources),
  },
  "eslint-10-floor": {
    eslintVersion: /^10\.0\.0$/,
    modules: { eslint: () => import("eslint-10-floor").then((eslint) => floorEslintSchema.parse(eslint)), ...floorTypescriptEslintModules },
    nativeRuleSources: () =>
      Promise.all([import("eslint-10-floor/use-at-your-own-risk"), floorTypescriptEslintRules()]).then(
        ([eslintCore, typescriptEslint]) => ({ eslintCore: eslintCore.builtinRules, typescriptEslint }),
      ),
  },
  "eslint-9": {
    eslintVersion: /^9\./,
    modules: { ...defaultEslintToolchainPeers.modules, eslint: () => import("eslint-9") },
    nativeRuleSources: () =>
      import("eslint-9/use-at-your-own-risk").then((eslintCore) => ({
        eslintCore: eslintCore.builtinRules,
        typescriptEslint: defaultNativeRuleSources.typescriptEslint,
      })),
  },
  "eslint-9-floor": {
    eslintVersion: /^9\.12\.0$/,
    modules: { eslint: () => import("eslint-9-floor").then((eslint) => floorEslintSchema.parse(eslint)), ...floorTypescriptEslintModules },
    nativeRuleSources: () =>
      Promise.all([import("eslint-9-floor/use-at-your-own-risk"), floorTypescriptEslintRules()]).then(
        ([eslintCore, typescriptEslint]) => ({ eslintCore: eslintCore.builtinRules, typescriptEslint }),
      ),
  },
};

const ruleObjectSchema = z.custom<object>((value) => typeof value === "object" && value !== null);

const nativeRulePieceSchema = z.object({
  createPlugin: z.function({
    input: [
      z.object({
        eslintCore: z.custom<ReadonlyMap<string, object>>((value) => value instanceof Map),
        typescriptEslint: z.record(z.string(), ruleObjectSchema),
      }),
    ],
    output: z.unknown(),
  }),
});

export const eslintPeersOn = (request: { readonly line: EslintLine }): EslintToolchainPeers => ({
  location: defaultEslintToolchainPeers.location,
  modules: LINES[request.line].modules,
});

export const loadedEslintToolchain = async (request: { readonly line: EslintLine }): Promise<EslintToolchain> => {
  const loaded = await loadEslintToolchain({ peers: eslintPeersOn(request) });
  assert(loaded.outcome === "ok", `the ${request.line} toolchain loads from the development install`);
  assert(
    LINES[request.line].eslintVersion.test(loaded.value.eslintVersion),
    `the ${request.line} toolchain runs ESLint ${loaded.value.eslintVersion}`,
  );
  return loaded.value;
};

export const eslintPortOn = async (request: { readonly line: EslintLine }): Promise<EslintPort> =>
  createEslintPort({ toolchain: await loadedEslintToolchain(request) });

const withNativeRuleSources = (request: { readonly namespace: unknown; readonly sources: NativeRuleSources }): unknown => {
  const piece = nativeRulePieceSchema.safeParse(request.namespace);
  return piece.success ? { default: piece.data.createPlugin(request.sources) } : request.namespace;
};

export const pieceModulesOn = (request: { readonly line: EslintLine; readonly base: ModuleLoaderPort }): ModuleLoaderPort => {
  const sources = LINES[request.line].nativeRuleSources();
  return {
    load: (load) =>
      Promise.all([request.base.load(load), sources]).then(([loaded, resolvedSources]) =>
        loaded.outcome === "failed"
          ? loaded
          : { outcome: "ok", value: withNativeRuleSources({ namespace: loaded.value, sources: resolvedSources }) },
      ),
  };
};

export const eslintRunnerOn = (request: { readonly line: EslintLine }): EmbeddedRunner =>
  toolchainBoundEmbeddedRunner({
    toolchain: loadedEslintToolchain(request).then((toolchain): Result<EslintToolchain, RunnerFailure> => ({ outcome: "ok", value: toolchain })),
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
