import type {
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
  TypeScriptWalkerCheck,
} from "../runner/typescript-parse.ts";

type Ambience = "ambient" | "runtime";

type NodeRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const ownAmbience = (request: NodeRequest): Ambience =>
  request.syntaxApi.canHaveModifiers(request.node) &&
  (request.syntaxApi.getModifiers(request.node) ?? []).some(
    (modifier) => modifier.kind === request.syntaxApi.SyntaxKind.DeclareKeyword,
  )
    ? "ambient"
    : "runtime";

const enclosingAmbience = (request: NodeRequest): Ambience => {
  if (request.syntaxApi.isSourceFile(request.node)) {
    return "runtime";
  }
  if (request.syntaxApi.isModuleDeclaration(request.node) && ownAmbience(request) === "ambient") {
    return "ambient";
  }
  return enclosingAmbience({ syntaxApi: request.syntaxApi, node: request.node.parent });
};

const classKeywordOf = (
  request: NodeRequest & { readonly tree: SyntaxTree },
): SyntaxNode | undefined =>
  request.node
    .getChildren(request.tree)
    .find((child) => child.kind === request.syntaxApi.SyntaxKind.ClassKeyword);

export const check: TypeScriptWalkerCheck = {
  kind: "syntax",
  inspect: (request) => {
    if (!request.syntaxApi.isClassLike(request.node)) {
      return [];
    }
    if (
      ownAmbience(request) === "ambient" ||
      enclosingAmbience({ syntaxApi: request.syntaxApi, node: request.node.parent }) === "ambient"
    ) {
      return [];
    }
    const keyword = classKeywordOf(request);
    return keyword === undefined
      ? []
      : [request.anchorAt({ position: keyword.getStart(request.tree) })];
  },
};
