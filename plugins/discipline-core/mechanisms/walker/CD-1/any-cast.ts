import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const SNIPPET_MAX_LENGTH = 80;
const ZOD_MODULE_SPECIFIER_PATTERN = /^zod(\/.*)?$/;
const CD1_ANY_PATTERN = /\bas\s+any\b|:\s*any\b|<any>/;
const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "dist-release",
  "build",
  "coverage",
  ".git",
  ".claude",
  "aidlc",
  ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor",
  ".codex",
  ".opencode",
  ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  const parents = request.file.split("/").slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  return "eligible";
};

type CastContext = {
  readonly node: SyntaxNode;
  readonly syntaxApi: SyntaxApi;
  readonly zodImportedNames: ReadonlySet<string>;
};

const namesImportedFromZod = (request: {
  readonly sourceFile: SyntaxTree;
  readonly syntaxApi: SyntaxApi;
}): ReadonlySet<string> => new Set(
  request.sourceFile.statements.flatMap((statement) => {
    if (!request.syntaxApi.isImportDeclaration(statement)) return [];
    if (!request.syntaxApi.isStringLiteral(statement.moduleSpecifier)) return [];
    if (!ZOD_MODULE_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)) return [];
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings === undefined || !request.syntaxApi.isNamedImports(namedBindings)) return [];
    return namedBindings.elements.map((element) => element.name.text);
  }),
);

const castPermission = (request: CastContext): "permitted" | "forbidden" => {
  if (!request.syntaxApi.isAsExpression(request.node)) return "forbidden";
  const typeNode = request.node.type;
  if (typeNode.kind === request.syntaxApi.SyntaxKind.UnknownKeyword) return "permitted";
  if (request.syntaxApi.isTypeReferenceNode(typeNode) && request.syntaxApi.isIdentifier(typeNode.typeName)) {
    const typeName = typeNode.typeName.text;
    if (typeName === "const" || request.zodImportedNames.has(typeName)) return "permitted";
    if (
      request.syntaxApi.isPropertyAccessExpression(request.node.expression) &&
      request.node.expression.name.text === "value" &&
      (typeName === "ReadonlyArray" || typeName === "Array")
    ) return "permitted";
  }
  if (!request.syntaxApi.isIndexedAccessTypeNode(typeNode)) return "forbidden";
  const objectType = typeNode.objectType;
  const indexType = typeNode.indexType;
  if (
    request.syntaxApi.isTypeReferenceNode(objectType) &&
    request.syntaxApi.isIdentifier(objectType.typeName) &&
    objectType.typeName.text === "Tool" &&
    request.syntaxApi.isLiteralTypeNode(indexType) &&
    request.syntaxApi.isStringLiteral(indexType.literal) &&
    indexType.literal.text === "inputSchema"
  ) return "permitted";
  return "forbidden";
};

const snippetAt = (request: {
  readonly sourceFile: SyntaxTree;
  readonly position: number;
}): string => {
  const snippet = request.sourceFile.text
    .slice(request.position, request.position + SNIPPET_MAX_LENGTH)
    .replace(/\n/g, " ");
  return snippet.length === SNIPPET_MAX_LENGTH ? `${snippet}…` : snippet;
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
              const zodImportedNames = namesImportedFromZod({ sourceFile, syntaxApi });
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  if (!syntaxApi.isAsExpression(node) && !syntaxApi.isTypeAssertionExpression(node)) return;
                  if (castPermission({ node, syntaxApi, zodImportedNames }) === "permitted") return;
                  const position = node.getStart(sourceFile);
                  const snippet = snippetAt({ sourceFile, position });
                  if (!CD1_ANY_PATTERN.test(snippet)) return;
                  const anchor = anchorAt({ position });
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
