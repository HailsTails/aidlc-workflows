import type { SyntaxNode } from "../runner/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../runner/walker-piece.ts";

const EXCLUDED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
]);
const EXCLUDED_ROOT_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  "vendor", ".codex", ".opencode", ".agents",
]);

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  const segments = request.file.split("/");
  const parents = segments.slice(0, -1);
  if (parents.some((directory) => EXCLUDED_DIRECTORY_NAMES.has(directory))) return "excluded";
  if (EXCLUDED_ROOT_DIRECTORY_NAMES.has(parents[0] ?? "")) return "excluded";
  if (segments.at(-1) === "audit-constitution.ts") return "excluded";
  return "eligible";
};

const BANNED_THIRD_PARTY_IMPORTS: readonly string[] = [
  "eslint", "winston", "winston-transport", "better-sqlite3", "pino", "hono", "@hono/node-server",
  "hono/cors", "hono/cookie", "hono/types", "hono/utils/http-status", "jose", "@modelcontextprotocol/sdk",
  "zod-to-json-schema", "uuid",
];

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
              const rawHits = sourceFile.text.split("\n").flatMap((line, index) =>
                BANNED_THIRD_PARTY_IMPORTS.filter((specifier) =>
                  new RegExp(`from\\s+["']${specifier.replace(/[/.]/g, "\\$&")}["']`).test(line),
                ).flatMap((specifier) => clauses.map((clause) => ({
                  clause: clause.address,
                  anchor: { line: index + 1, column: 0 },
                  snippet: `banned third-party import: ${specifier} — use its recorded wrapping boundary`,
                }))),
              );
              const nodeHits: PieceHit[] = [];
              const record = (specifier: SyntaxNode | undefined): void => {
                if (specifier === undefined || !syntaxApi.isStringLiteralLike(specifier) || !specifier.text.startsWith("node:")) return;
                const anchor = anchorAt({ position: specifier.getStart(sourceFile) });
                const snippet = `bare node: stdlib import - use the kernel port package: ${specifier.text}`;
                nodeHits.push(...clauses.map((clause) => ({ clause: clause.address, anchor, snippet })));
              };
              return {
                enter: ({ node }) => {
                  if (syntaxApi.isImportDeclaration(node) || syntaxApi.isExportDeclaration(node)) {
                    record(node.moduleSpecifier);
                  } else if (syntaxApi.isImportTypeNode(node) && syntaxApi.isLiteralTypeNode(node.argument)) {
                    record(node.argument.literal);
                  } else if (syntaxApi.isImportEqualsDeclaration(node) && syntaxApi.isExternalModuleReference(node.moduleReference)) {
                    record(node.moduleReference.expression);
                  } else if (syntaxApi.isCallExpression(node) && (node.expression.kind === syntaxApi.SyntaxKind.ImportKeyword ||
                    (syntaxApi.isIdentifier(node.expression) && node.expression.text === "require"))) {
                    record(node.arguments[0]);
                  }
                },
                finish: () => [...rawHits, ...nodeHits],
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
