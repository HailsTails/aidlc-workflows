import typescript from "typescript";

export type SyntaxApi = typeof typescript;
export type SyntaxTree = typescript.SourceFile;
export type SyntaxNode = typescript.Node;
export type CommentRange = typescript.CommentRange;

export type TypeScriptParsePort = {
  readonly syntaxApi: SyntaxApi;
  readonly parse: (request: { readonly fileName: string; readonly source: string }) => SyntaxTree;
  readonly children: (request: { readonly node: SyntaxNode }) => readonly SyntaxNode[];
};

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
