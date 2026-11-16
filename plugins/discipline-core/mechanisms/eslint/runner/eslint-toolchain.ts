import type typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { loadedPeer, type PeerToolchain, type ToolchainRequirement } from "../../../core/mechanism-port/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import type { Result } from "../../../core/values/result.ts";
import { createEslintOn, type EslintModule, type EslintToolchain, type TypescriptParser } from "./eslint-instance.ts";

export type TypescriptEslintPluginModule = { readonly default: Pick<typeof typescriptEslintPlugin, "meta"> };

export type EslintToolchainModules = {
  readonly eslint: () => Promise<EslintModule>;
  readonly typescriptParser: () => Promise<TypescriptParser>;
  readonly typescriptEslintPlugin: () => Promise<TypescriptEslintPluginModule>;
};

export type EslintToolchainPeers = PeerToolchain<EslintToolchainModules>;

type ToolchainLoad<T> = Promise<Result<T, RunnerFailure>>;

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

export const defaultEslintToolchainModules: EslintToolchainModules = {
  eslint: () => import("eslint"),
  typescriptParser: () => import("@typescript-eslint/parser"),
  typescriptEslintPlugin: () => import("@typescript-eslint/eslint-plugin"),
};

export const defaultEslintToolchainPeers = (options: { readonly installRoot: string }): EslintToolchainPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultEslintToolchainModules,
});
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
