import type { ESLint } from "eslint";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { loadedPeer, type ToolchainRequirement } from "../../../core/mechanism-port/toolchain-requirement.ts";
import type { Result } from "../../../core/values/result.ts";
import type {
  CreateEslint,
  EslintSurfaceOptions,
  EslintToolchain,
  LintedFile,
  LintedMessage,
  TypescriptParser,
} from "./eslint-instance.ts";

type EslintEngine = Pick<ESLint, "isPathIgnored" | "calculateConfigForFile" | "lintFiles" | "lintText">;

export type EslintClass = {
  readonly version: string;
  new (options: ESLint.Options): EslintEngine;
};

export type EslintModule = { readonly ESLint: EslintClass };

export type VersionedDefault = { readonly default: { readonly version: string } };

export type TypescriptEslintPluginModule = { readonly default: { readonly meta: { readonly version?: string } } };

export type EslintToolchainModules = {
  readonly typescript: () => Promise<VersionedDefault>;
  readonly eslint: () => Promise<EslintModule>;
  readonly typescriptParser: () => Promise<TypescriptParser>;
  readonly typescriptEslintPlugin: () => Promise<TypescriptEslintPluginModule>;
};

type EslintDialect = "eslint-9" | "eslint-10";

type ToolchainLoad<T> = Promise<Result<T, RunnerFailure>>;

const NEAREST_CONFIG_LOOKUP_FLAG = "v10_config_lookup_from_file";

const ESLINT_9_MAJOR = "9.";

const UNKNOWN_VERSION = "unknown version";

export const TYPESCRIPT_REQUIREMENT: ToolchainRequirement = {
  packageName: "typescript",
  lines: [{ floor: "6.0.3", stays: "within-minor" }],
};

export const ESLINT_REQUIREMENT: ToolchainRequirement = {
  packageName: "eslint",
  lines: [
    { floor: "9.39.5", stays: "within-major" },
    { floor: "10.11.0", stays: "within-major" },
  ],
};

export const TYPESCRIPT_ESLINT_PARSER_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/parser",
  lines: [{ floor: "8.71.2", stays: "within-major" }],
};

export const TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/eslint-plugin",
  lines: [{ floor: "8.71.2", stays: "within-major" }],
};

export const ESLINT_TOOLCHAIN_REQUIREMENTS: readonly ToolchainRequirement[] = [
  TYPESCRIPT_REQUIREMENT,
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
];

export const defaultEslintToolchainModules: EslintToolchainModules = {
  typescript: () => import("typescript"),
  eslint: () => import("eslint"),
  typescriptParser: () => import("@typescript-eslint/parser"),
  typescriptEslintPlugin: () => import("@typescript-eslint/eslint-plugin"),
};

const dialectOf = (request: { readonly eslintClass: EslintClass }): EslintDialect =>
  request.eslintClass.version.startsWith(ESLINT_9_MAJOR) ? "eslint-9" : "eslint-10";

const lintedMessageOf = (message: ESLint.LintResult["messages"][number]): LintedMessage => ({
  ruleId: message.ruleId,
  ...(message.messageId === undefined ? {} : { messageId: message.messageId }),
  line: message.line,
  column: message.column,
  message: message.message,
  ...(message.fatal === true ? { fatal: true } : {}),
});

const lintedFileOf = (lintResult: ESLint.LintResult): LintedFile => ({
  filePath: lintResult.filePath,
  messages: lintResult.messages.map(lintedMessageOf),
});

const overrideConfigOf = (request: {
  readonly overrideConfig: NonNullable<EslintSurfaceOptions["overrideConfig"]>;
}): ESLint.Options["overrideConfig"] => ({
  ...request.overrideConfig,
  files: [...request.overrideConfig.files],
  rules: Object.fromEntries(
    Object.entries(request.overrideConfig.rules).map(([ruleId, entry]) => [
      ruleId,
      typeof entry === "string" ? entry : [...entry],
    ]),
  ),
});

const dialectOptions = (request: {
  readonly dialect: EslintDialect;
  readonly options: EslintSurfaceOptions;
}): ESLint.Options => {
  switch (request.dialect) {
    case "eslint-10":
      return request.options.applySuppressions === undefined ? {} : { applySuppressions: request.options.applySuppressions };
    case "eslint-9":
      return request.options.overrideConfigFile === undefined ? { flags: [NEAREST_CONFIG_LOOKUP_FLAG] } : {};
  }
};

export const eslintOptionsOf = (request: {
  readonly dialect: EslintDialect;
  readonly options: EslintSurfaceOptions;
}): ESLint.Options => {
  const { overrideConfig, applySuppressions: _suppressionsByDialect, ...sharedOptions } = request.options;
  return {
    ...sharedOptions,
    ...dialectOptions(request),
    ...(overrideConfig === undefined ? {} : { overrideConfig: overrideConfigOf({ overrideConfig }) }),
  };
};

export const createEslintOn = (request: { readonly eslintClass: EslintClass }): CreateEslint => {
  const dialect = dialectOf({ eslintClass: request.eslintClass });
  return (create) => {
    const eslint = new request.eslintClass(eslintOptionsOf({ dialect, options: create.options }));
    return {
      isPathIgnored: (query) => eslint.isPathIgnored(query.filePath),
      calculateConfigForFile: (query) => eslint.calculateConfigForFile(query.filePath),
      lintFiles: (lint) => eslint.lintFiles([...lint.filePaths]).then((results) => results.map(lintedFileOf)),
      lintText: (lint) =>
        eslint.lintText(lint.code, { filePath: lint.filePath }).then((results) => results.map(lintedFileOf)),
    };
  };
};

const afterLoaded = <Loaded, Next>(request: {
  readonly loaded: ToolchainLoad<Loaded>;
  readonly next: (loaded: Loaded) => ToolchainLoad<Next>;
}): ToolchainLoad<Next> =>
  request.loaded.then((loaded) => (loaded.outcome === "failed" ? loaded : request.next(loaded.value)));

const loadedTypescriptEslintPlugin = (request: {
  readonly modules: EslintToolchainModules;
}): ToolchainLoad<TypescriptEslintPluginModule> =>
  loadedPeer({
    requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
    load: request.modules.typescriptEslintPlugin,
    versionOf: (plugin) => plugin.default.meta.version ?? UNKNOWN_VERSION,
  });

const loadedParserAndPlugin = (request: {
  readonly modules: EslintToolchainModules;
  readonly eslint: EslintModule;
}): ToolchainLoad<EslintToolchain> =>
  afterLoaded({
    loaded: loadedPeer({
      requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
      load: request.modules.typescriptParser,
      versionOf: (parser) => parser.version,
    }),
    next: (typescriptParser) =>
      afterLoaded({
        loaded: loadedTypescriptEslintPlugin({ modules: request.modules }),
        next: (): ToolchainLoad<EslintToolchain> =>
          Promise.resolve({
            outcome: "ok",
            value: { createEslint: createEslintOn({ eslintClass: request.eslint.ESLint }), typescriptParser },
          }),
      }),
  });

export const loadEslintToolchain = (request: { readonly modules: EslintToolchainModules }): ToolchainLoad<EslintToolchain> =>
  afterLoaded({
    loaded: loadedPeer({
      requirement: TYPESCRIPT_REQUIREMENT,
      load: request.modules.typescript,
      versionOf: (typescript) => typescript.default.version,
    }),
    next: () =>
      afterLoaded({
        loaded: loadedPeer({
          requirement: ESLINT_REQUIREMENT,
          load: request.modules.eslint,
          versionOf: (eslint) => eslint.ESLint.version,
        }),
        next: (eslint) => loadedParserAndPlugin({ modules: request.modules, eslint }),
      }),
  });
