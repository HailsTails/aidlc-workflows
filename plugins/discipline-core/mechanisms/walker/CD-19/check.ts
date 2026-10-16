import type ts from "typescript";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import { inspectParsedFiles } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

type ConstitutionViolation = {
  readonly rule: string;
  readonly file: RepoPath;
  readonly line: number;
  readonly snippet: string;
};

const basename = (file: string): string => file.split(/[\\/]/).at(-1) ?? file;
const splitLines = (content: string): readonly string[] => content.split("\n");
const located = (finding: ConstitutionViolation): LocatedSnippet => ({
  file: finding.file,
  anchor: { line: Math.max(1, finding.line), column: 0 },
  snippet: finding.snippet,
});

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      if (basename(file) === "audit-constitution.ts") {
        return [];
      }
      const BANNED_THIRD_PARTY_IMPORTS: readonly string[] = [
        "eslint",
        "winston",
        "winston-transport",
        "better-sqlite3",
        "pino",
        "hono",
        "@hono/node-server",
        "hono/cors",
        "hono/cookie",
        "hono/types",
        "hono/utils/http-status",
        "jose",
        "@modelcontextprotocol/sdk",
        "zod-to-json-schema",
        "uuid",
      ];

      const checkBannedImports = (
        filePath: RepoPath,
        content: string,
      ): readonly ConstitutionViolation[] =>
        splitLines(content)
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .flatMap(({ line, lineNumber }) =>
            BANNED_THIRD_PARTY_IMPORTS.filter((bannedSpecifier) =>
              new RegExp(
                `from\\s+["']${bannedSpecifier.replace(/[/.]/g, "\\$&")}["']`,
              ).test(line),
            ).map(
              (bannedSpecifier): ConstitutionViolation => ({
                rule: "CD-19",
                file: filePath,
                line: lineNumber,
                snippet: `banned third-party import: ${bannedSpecifier} — use its recorded wrapping boundary`,
              }),
            ),
          );

      const checkNodeStdlibImports = (
        filePath: RepoPath,
      ): readonly ConstitutionViolation[] => {
        const source = parsed.tree;
        const findings: ConstitutionViolation[] = [];
        const record = (specifier: ts.Expression | undefined): void => {
          if (
            specifier === undefined ||
            !ts.isStringLiteralLike(specifier) ||
            !specifier.text.startsWith("node:")
          ) return;
          const line = source.getLineAndCharacterOfPosition(specifier.getStart(source)).line + 1;
          findings.push({
            rule: "CD-20",
            file: filePath,
            line,
            snippet: `bare node: stdlib import - use the kernel port package: ${specifier.text}`,
          });
        };
        parsed.nodes.forEach((node) => {
          if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            record(node.moduleSpecifier);
          } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            record(node.argument.literal);
          } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference)
          ) {
            record(node.moduleReference.expression);
          } else if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) && node.expression.text === "require"))
          ) {
            record(node.arguments[0]);
          }
        });
        return findings;
      };

      return [...checkBannedImports(file, parsed.source), ...checkNodeStdlibImports(file)].map(located);
    },
  }),
};
