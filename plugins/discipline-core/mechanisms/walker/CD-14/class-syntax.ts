import type {
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
} from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

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

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (!/\.(?:ts|tsx|mts|cts)$/.test(file) || /\.d\.(?:ts|mts|cts)$/.test(file)) {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              const lines = sourceFile.text.split(/\r\n|[\r\n\u2028\u2029]/g);
              return {
                enter: ({ node }) => {
                  if (!syntaxApi.isClassLike(node)) return;
                  if (ownAmbience({ syntaxApi, node }) === "ambient" ||
                    enclosingAmbience({ syntaxApi, node: node.parent }) === "ambient") return;
                  const keyword = classKeywordOf({ syntaxApi, node, tree: sourceFile });
                  if (keyword === undefined) return;
                  const anchor = anchorAt({ position: keyword.getStart(sourceFile) });
                  clauses.forEach((clause) => {
                    hits.push({ clause: clause.address, anchor, snippet: lines[anchor.line - 1]?.trim() ?? "" });
                  });
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
