import typescript from "typescript";
import type { ParsePort, WalkerCheck } from "./walker-check.ts";

export type SyntaxApi = typeof typescript;
export type SyntaxTree = typescript.SourceFile;
export type SyntaxNode = typescript.Node;
export type TypeScriptWalkerCheck = WalkerCheck<SyntaxApi, SyntaxTree, SyntaxNode>;
export type TypeScriptParsePort = ParsePort<SyntaxApi, SyntaxTree, SyntaxNode>;

const directChildren = (request: { readonly node: SyntaxNode }): readonly SyntaxNode[] => {
  const collected: SyntaxNode[] = [];
  typescript.forEachChild(request.node, (child) => {
    collected.push(child);
  });
  return collected;
};

export const createDefaultParsePort = (
  _options: Record<string, never>,
): TypeScriptParsePort => ({
  syntaxApi: typescript,
  parse: (request) =>
    typescript.createSourceFile(
      request.fileName,
      request.source,
      typescript.ScriptTarget.Latest,
      true,
    ),
  children: directChildren,
});
