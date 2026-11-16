import type typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import type { ESLint } from "eslint";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import {
  loadedPeer,
  type PeerToolchain,
  type ToolchainRequirement,
  versionSupport,
} from "../../../core/mechanism-port/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
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

export type EslintClass = Pick<typeof ESLint, "version"> &
  (new (...options: ConstructorParameters<typeof ESLint>) => EslintEngine);

export type EslintModule = { readonly ESLint: EslintClass };

export type TypescriptEslintPluginModule = { readonly default: Pick<typeof typescriptEslintPlugin, "meta"> };

export type EslintToolchainModules = {
  readonly eslint: () => Promise<EslintModule>;
  readonly typescriptParser: () => Promise<TypescriptParser>;
  readonly typescriptEslintPlugin: () => Promise<TypescriptEslintPluginModule>;
};

export type EslintToolchainPeers = PeerToolchain<EslintToolchainModules>;

type ToolchainLoad<T> = Promise<Result<T, RunnerFailure>>;

type ConfigLookup = { readonly releases: ToolchainRequirement; readonly flags: readonly string[] };

export const ESLINT_REQUIREMENT: ToolchainRequirement = {
  packageName: "eslint",
  lines: [
    { floor: "9.12.0", below: "10.0.0" },
    { floor: "10.0.0", below: "11.0.0" },
  ],
};

export const TYPESCRIPT_ESLINT_PARSER_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/parser",
  lines: [{ floor: "8.56.0", below: "9.0.0" }],
};

export const TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT: ToolchainRequirement = {
  packageName: "@typescript-eslint/eslint-plugin",
  lines: [{ floor: "8.56.0", below: "9.0.0" }],
};

export const ESLINT_TOOLCHAIN_REQUIREMENTS: readonly ToolchainRequirement[] = [
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
];

const NEAREST_CONFIG_LOOKUPS: readonly ConfigLookup[] = [
  { releases: { packageName: "eslint", lines: [{ floor: "9.12.0", below: "9.30.0" }] }, flags: ["unstable_config_lookup_from_file"] },
  { releases: { packageName: "eslint", lines: [{ floor: "9.30.0", below: "10.0.0" }] }, flags: ["v10_config_lookup_from_file"] },
];

export const defaultEslintToolchainPeers: EslintToolchainPeers = {
  location: createDefaultPackageLocationPort({}),
  modules: {
    eslint: () => import("eslint"),
    typescriptParser: () => import("@typescript-eslint/parser"),
    typescriptEslintPlugin: () => import("@typescript-eslint/eslint-plugin"),
  },
};

const lookupFlagsOf = (request: { readonly version: string }): readonly string[] =>
  NEAREST_CONFIG_LOOKUPS.find((lookup) => versionSupport({ requirement: lookup.releases, version: request.version }) === "supported")
    ?.flags ?? [];

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

const lookupOptionsOf = (request: { readonly version: string; readonly options: EslintSurfaceOptions }): ESLint.Options => {
  const flags = lookupFlagsOf(request);
  return request.options.overrideConfigFile === undefined && flags.length > 0 ? { flags: [...flags] } : {};
};

export const eslintOptionsOf = (request: {
  readonly version: string;
  readonly options: EslintSurfaceOptions;
}): ESLint.Options => {
  const { overrideConfig, ...sharedOptions } = request.options;
  return {
    ...sharedOptions,
    ...lookupOptionsOf(request),
    ...(overrideConfig === undefined ? {} : { overrideConfig: overrideConfigOf({ overrideConfig }) }),
  };
};

export const createEslintOn = (request: { readonly eslintClass: EslintClass }): CreateEslint => (create) => {
  const eslint = new request.eslintClass(eslintOptionsOf({ version: request.eslintClass.version, options: create.options }));
  return {
    isPathIgnored: (query) => eslint.isPathIgnored(query.filePath),
    calculateConfigForFile: (query) => eslint.calculateConfigForFile(query.filePath),
    lintFiles: (lint) => eslint.lintFiles([...lint.filePaths]).then((results) => results.map(lintedFileOf)),
    lintText: (lint) =>
      eslint.lintText(lint.code, { filePath: lint.filePath }).then((results) => results.map(lintedFileOf)),
  };
};

const afterLoaded = <Loaded, Next>(request: {
  readonly loaded: ToolchainLoad<Loaded>;
  readonly next: (loaded: Loaded) => ToolchainLoad<Next>;
}): ToolchainLoad<Next> =>
  request.loaded.then((loaded) => (loaded.outcome === "failed" ? loaded : request.next(loaded.value)));

const loadedToolchainOn = (request: {
  readonly peers: EslintToolchainPeers;
  readonly eslint: EslintModule;
  readonly typescriptParser: TypescriptParser;
}): ToolchainLoad<EslintToolchain> =>
  afterLoaded({
    loaded: loadedPeer({
      requirement: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
      location: request.peers.location,
      load: request.peers.modules.typescriptEslintPlugin,
      versionOf: (plugin) => plugin.default.meta.version,
    }),
    next: () =>
      Promise.resolve({
        outcome: "ok",
        value: {
          eslintVersion: request.eslint.ESLint.version,
          createEslint: createEslintOn({ eslintClass: request.eslint.ESLint }),
          typescriptParser: request.typescriptParser,
        },
      }),
  });

export const loadEslintToolchain = (request: { readonly peers: EslintToolchainPeers }): ToolchainLoad<EslintToolchain> =>
  afterLoaded({
    loaded: loadedPeer({
      requirement: ESLINT_REQUIREMENT,
      location: request.peers.location,
      load: request.peers.modules.eslint,
      versionOf: (eslint) => eslint.ESLint.version,
    }),
    next: (eslint) =>
      afterLoaded({
        loaded: loadedPeer({
          requirement: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
          location: request.peers.location,
          load: request.peers.modules.typescriptParser,
          versionOf: (parser) => parser.version,
        }),
        next: (typescriptParser) => loadedToolchainOn({ peers: request.peers, eslint, typescriptParser }),
      }),
  });
