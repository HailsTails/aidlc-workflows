import type { SyntaxApi, SyntaxNode } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  const parents = request.file.split("/").slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
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
