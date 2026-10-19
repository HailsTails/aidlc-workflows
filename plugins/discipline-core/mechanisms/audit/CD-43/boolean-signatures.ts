import type { SyntaxApi, SyntaxNode } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";
import { folderScope } from "../runner/source-scope.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

const booleanTypeOf = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): "boolean-like" | "other" => {
  if (request.node.kind === request.syntaxApi.SyntaxKind.BooleanKeyword) return "boolean-like";
  if (!request.syntaxApi.isUnionTypeNode(request.node)) return "other";
  if (!request.node.types.some((member) => member.kind === request.syntaxApi.SyntaxKind.BooleanKeyword)) return "other";
  return request.node.types.every((member) =>
    member.kind === request.syntaxApi.SyntaxKind.BooleanKeyword ||
    member.kind === request.syntaxApi.SyntaxKind.UndefinedKeyword ||
    (request.syntaxApi.isLiteralTypeNode(member) && member.literal.kind === request.syntaxApi.SyntaxKind.NullKeyword),
  ) ? "boolean-like" : "other";
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (sourceEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  if (!(syntaxApi.isParameter(node) || syntaxApi.isPropertySignature(node) ||
                    syntaxApi.isFunctionDeclaration(node) || syntaxApi.isFunctionExpression(node) ||
                    syntaxApi.isArrowFunction(node) || syntaxApi.isMethodDeclaration(node) ||
                    syntaxApi.isMethodSignature(node) || syntaxApi.isFunctionTypeNode(node) ||
                    syntaxApi.isConstructorTypeNode(node) || syntaxApi.isCallSignatureDeclaration(node) ||
                    syntaxApi.isConstructSignatureDeclaration(node) || syntaxApi.isGetAccessorDeclaration(node) ||
                    syntaxApi.isIndexSignatureDeclaration(node))) return;
                  if (node.type === undefined || syntaxApi.isTypePredicateNode(node.type)) return;
                  if (booleanTypeOf({ node: node.type, syntaxApi }) !== "boolean-like") return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const rawSnippet = sourceFile.text.slice(position, position + 80).replace(/\n/g, " ");
                  const snippet = rawSnippet.length === 80 ? `${rawSnippet}…` : rawSnippet;
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
