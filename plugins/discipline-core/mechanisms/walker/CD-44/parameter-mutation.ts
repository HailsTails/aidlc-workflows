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

const MUTATING_METHOD_NAMES: readonly string[] = [
  "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin",
];

const bindingNamesOf = (request: { readonly binding: SyntaxNode; readonly syntaxApi: SyntaxApi }): readonly string[] => {
  if (request.syntaxApi.isIdentifier(request.binding)) return [request.binding.text];
  if (request.syntaxApi.isObjectBindingPattern(request.binding) || request.syntaxApi.isArrayBindingPattern(request.binding)) {
    return request.binding.elements.flatMap((element) => request.syntaxApi.isOmittedExpression(element)
      ? []
      : bindingNamesOf({ binding: element.name, syntaxApi: request.syntaxApi }));
  }
  return [];
};

const accessRootOf = (request: { readonly expression: SyntaxNode; readonly syntaxApi: SyntaxApi }): string | undefined => {
  if (request.syntaxApi.isPropertyAccessExpression(request.expression) || request.syntaxApi.isElementAccessExpression(request.expression)) {
    return accessRootOf({ expression: request.expression.expression, syntaxApi: request.syntaxApi });
  }
  return request.syntaxApi.isIdentifier(request.expression) ? request.expression.text : undefined;
};

const mutationRootOf = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): string | undefined => {
  const { node, syntaxApi } = request;
  if (syntaxApi.isBinaryExpression(node) && node.operatorToken.kind === syntaxApi.SyntaxKind.EqualsToken &&
    (syntaxApi.isPropertyAccessExpression(node.left) || syntaxApi.isElementAccessExpression(node.left))) {
    return accessRootOf({ expression: node.left, syntaxApi });
  }
  if (syntaxApi.isDeleteExpression(node) &&
    (syntaxApi.isPropertyAccessExpression(node.expression) || syntaxApi.isElementAccessExpression(node.expression))) {
    return accessRootOf({ expression: node.expression, syntaxApi });
  }
  if (syntaxApi.isCallExpression(node) && syntaxApi.isPropertyAccessExpression(node.expression) &&
    MUTATING_METHOD_NAMES.includes(node.expression.name.text)) {
    return accessRootOf({ expression: node.expression.expression, syntaxApi });
  }
  return undefined;
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
              const scopes: ReadonlySet<string>[] = [];
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  if (syntaxApi.isFunctionDeclaration(node) || syntaxApi.isArrowFunction(node) ||
                    syntaxApi.isFunctionExpression(node) || syntaxApi.isMethodDeclaration(node)) {
                    scopes.push(new Set(node.parameters.flatMap((parameter) => bindingNamesOf({ binding: parameter.name, syntaxApi }))));
                  }
                  const root = mutationRootOf({ node, syntaxApi });
                  if (root === undefined || !scopes.some((scope) => scope.has(root))) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const rawSnippet = sourceFile.text.slice(position, position + 80).replace(/\n/g, " ");
                  const snippet = rawSnippet.length === 80 ? `${rawSnippet}…` : rawSnippet;
                  hits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
                },
                leave: ({ node }) => {
                  if (syntaxApi.isFunctionDeclaration(node) || syntaxApi.isArrowFunction(node) ||
                    syntaxApi.isFunctionExpression(node) || syntaxApi.isMethodDeclaration(node)) {
                    scopes.pop();
                  }
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
