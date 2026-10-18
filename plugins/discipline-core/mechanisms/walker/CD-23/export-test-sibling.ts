import type { WalkerPiece } from "../runner/walker-piece.ts";

const PRUNED_DIRECTORIES: readonly string[] = [
  "node_modules", "dist", "dist-release", "build", "coverage", ".git", ".claude", "aidlc", ".aidlc",
];

const PRUNED_ROOT_DIRECTORIES: readonly string[] = ["vendor", ".codex", ".opencode", ".agents"];

const directoryEligibility = (request: {
  readonly directories: readonly string[];
}): "eligible" | "skipped" =>
  PRUNED_ROOT_DIRECTORIES.includes(request.directories[0] ?? "") ||
  request.directories.some((directory) => PRUNED_DIRECTORIES.includes(directory))
    ? "skipped"
    : "eligible";

const productionFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  const directories = request.file.split("/").slice(0, -1);
  const fileName = request.file.slice(request.file.lastIndexOf("/") + 1);
  if (
    (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) ||
    request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx") ||
    request.file.endsWith(".d.ts") || directories.includes("__tests__") ||
    ["App.tsx", "main.tsx", "audit-constitution.ts"].includes(fileName) ||
    directoryEligibility({ directories }) === "skipped"
  ) return "skipped";
  if (
    directories[0] === "scripts" &&
    directoryEligibility({ directories: directories.slice(1) }) === "eligible"
  ) return "skipped";
  return "eligible";
};

const testSiblingOf = (request: { readonly file: string }): string =>
  request.file.endsWith(".tsx")
    ? request.file.replace(/\.tsx$/, ".test.tsx")
    : request.file.replace(/\.ts$/, ".test.ts");

export const check: WalkerPiece = {
  prepare: ({ clauses, repository, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (productionFileEligibility({ file }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hasRuntimeExport = sourceFile.statements.some((statement) => {
                if (syntaxApi.isExportAssignment(statement)) return true;
                const modifierKinds = (syntaxApi.canHaveModifiers(statement)
                  ? (syntaxApi.getModifiers(statement) ?? [])
                  : []).map((modifier) => modifier.kind);
                if (
                  [syntaxApi.SyntaxKind.VariableStatement, syntaxApi.SyntaxKind.FunctionDeclaration,
                    syntaxApi.SyntaxKind.ClassDeclaration, syntaxApi.SyntaxKind.EnumDeclaration].includes(statement.kind) &&
                  modifierKinds.includes(syntaxApi.SyntaxKind.ExportKeyword) &&
                  !modifierKinds.includes(syntaxApi.SyntaxKind.DeclareKeyword)
                ) return true;
                return syntaxApi.isExportDeclaration(statement) && !statement.isTypeOnly &&
                  statement.exportClause !== undefined && syntaxApi.isNamedExports(statement.exportClause) &&
                  statement.exportClause.elements.some((specifier) => !specifier.isTypeOnly);
              });
              const sibling = testSiblingOf({ file });
              const hasSibling = repository.files.some((candidate) => candidate === sibling);
              return {
                finish: () => hasRuntimeExport && !hasSibling
                  ? clauses.map((clause) => ({
                    clause: clause.address,
                    anchor: anchorAt({ position: 0 }),
                    snippet: "missing co-located *.test.ts(x) sibling",
                  }))
                  : [],
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
