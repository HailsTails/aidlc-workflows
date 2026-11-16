import type typescript from "typescript";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import { loadedPeer, type PeerToolchain, type ToolchainRequirement } from "../../../core/mechanism-port/toolchain-requirement.ts";
import { createDefaultPackageLocationPort } from "../../../core/platform-ports/package-location-port.ts";
import type { InstallForm } from "../../../core/values/install-layout.ts";
import type { Result } from "../../../core/values/result.ts";

export type SyntaxApi = typeof typescript;
export type SyntaxTree = typescript.SourceFile;
export type SyntaxNode = typescript.Node;
export type CommentRange = typescript.CommentRange;

export type TypeScriptParsePort = {
  readonly syntaxApi: SyntaxApi;
  readonly parse: (request: { readonly fileName: string; readonly source: string }) => SyntaxTree;
  readonly children: (request: { readonly node: SyntaxNode }) => readonly SyntaxNode[];
};

export type TypeScriptModules = { readonly typescript: () => Promise<{ readonly default: SyntaxApi }> };

export type TypeScriptPeers = PeerToolchain<TypeScriptModules>;

export const TYPESCRIPT_REQUIREMENT: ToolchainRequirement = {
  packageName: "typescript",
  lines: [{ floor: "4.8.4", below: "7.0.0" }],
};

export const defaultTypeScriptModules: TypeScriptModules = { typescript: () => import("typescript") };

export const defaultTypeScriptPeers = (options: { readonly installRoot: string; readonly installForm: InstallForm }): TypeScriptPeers => ({
  location: createDefaultPackageLocationPort(options),
  modules: defaultTypeScriptModules,
});

const directChildren = (request: { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const collected: SyntaxNode[] = [];
  request.syntaxApi.forEachChild(request.node, (child) => {
    collected.push(child);
  });
  return collected;
};

export const createParsePort = (options: { readonly syntaxApi: SyntaxApi }): TypeScriptParsePort => ({
  syntaxApi: options.syntaxApi,
  parse: (request) =>
    options.syntaxApi.createSourceFile(request.fileName, request.source, options.syntaxApi.ScriptTarget.Latest, true),
  children: (request) => directChildren({ syntaxApi: options.syntaxApi, node: request.node }),
});

export const loadParsePort = (request: { readonly peers: TypeScriptPeers }): Promise<Result<TypeScriptParsePort, RunnerFailure>> =>
  loadedPeer({
    requirement: TYPESCRIPT_REQUIREMENT,
    location: request.peers.location,
    load: request.peers.modules.typescript,
    versionOf: (loaded) => loaded.default.version,
  }).then((loaded) =>
    loaded.outcome === "failed" ? loaded : { outcome: "ok", value: createParsePort({ syntaxApi: loaded.value.default }) },
  );
