import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

type Ambience = "ambient" | "runtime";

type NodeRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const TYPESCRIPT_SOURCE_ENDINGS: readonly string[] = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_FILE_ENDINGS: readonly string[] = [".d.ts", ".d.mts", ".d.cts"];

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" =>
  TYPESCRIPT_SOURCE_ENDINGS.some((ending) => request.file.endsWith(ending)) &&
  !DECLARATION_FILE_ENDINGS.some((ending) => request.file.endsWith(ending))
    ? "eligible"
    : "excluded";

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

const lineTextAt = (request: { readonly tree: SyntaxTree; readonly position: number }): string => {
  const { line } = request.tree.getLineAndCharacterOfPosition(request.position);
  const starts = request.tree.getLineStarts();
  return request.tree.text.slice(starts[line] ?? 0, starts[line + 1] ?? request.tree.text.length).trim();
};

const authoredClassKeyword = (
  request: NodeRequest & { readonly tree: SyntaxTree },
): SyntaxNode | undefined => {
  if (!request.syntaxApi.isClassLike(request.node)) return undefined;
  if (
    ownAmbience(request) === "ambient" ||
    enclosingAmbience({ syntaxApi: request.syntaxApi, node: request.node.parent }) === "ambient"
  ) {
    return undefined;
  }
  return classKeywordOf(request);
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const keyword = authoredClassKeyword({ syntaxApi, node, tree: sourceFile });
                  if (keyword === undefined) return;
                  const position = keyword.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = lineTextAt({ tree: sourceFile, position });
                  hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
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
