import ts from "typescript";

type ExportSurface = "types-only" | "carries-runtime";

const RUNTIME_DECLARATION_KINDS: readonly ts.SyntaxKind[] = [
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
];

const modifierKindsOf = (statement: ts.Statement): readonly ts.SyntaxKind[] =>
  (ts.canHaveModifiers(statement)
    ? (ts.getModifiers(statement) ?? [])
    : []
  ).map((modifier) => modifier.kind);

const exportsRuntimeDeclaration = (statement: ts.Statement): boolean => {
  const modifierKinds = modifierKindsOf(statement);
  return (
    RUNTIME_DECLARATION_KINDS.includes(statement.kind) &&
    modifierKinds.includes(ts.SyntaxKind.ExportKeyword) &&
    !modifierKinds.includes(ts.SyntaxKind.DeclareKeyword)
  );
};

const exportListNamesRuntimeValue = (statement: ts.Statement): boolean =>
  ts.isExportDeclaration(statement) &&
  !statement.isTypeOnly &&
  statement.exportClause !== undefined &&
  ts.isNamedExports(statement.exportClause) &&
  statement.exportClause.elements.some((specifier) => !specifier.isTypeOnly);

const statementCarriesRuntimeExport = (statement: ts.Statement): boolean =>
  ts.isExportAssignment(statement) ||
  exportsRuntimeDeclaration(statement) ||
  exportListNamesRuntimeValue(statement);

const exportSurfaceOf = ({
  fileName,
  sourceText,
}: {
  readonly fileName: string;
  readonly sourceText: string;
}): ExportSurface => {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    false,
  );
  return sourceFile.statements.some(statementCarriesRuntimeExport)
    ? "carries-runtime"
    : "types-only";
};

export { type ExportSurface, exportSurfaceOf };
