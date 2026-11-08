import * as ts from "typescript";
import type { ModuleShape } from "../domain/deletion.ts";
import type { ModuleReader } from "../application/ports.ts";

const bindingNames = (name: ts.BindingName): readonly string[] =>
  ts.isIdentifier(name)
    ? [name.text]
    : name.elements.flatMap((element) =>
        ts.isOmittedExpression(element) ? [] : bindingNames(element.name),
      );

const isNamedDeclaration = (
  statement: ts.Statement,
): statement is
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.ModuleDeclaration =>
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isEnumDeclaration(statement) ||
  ts.isModuleDeclaration(statement);

const declaredBy = (statement: ts.Statement): readonly string[] => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((d) => bindingNames(d.name));
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return [statement.name?.text ?? "default"];
  }
  if (isNamedDeclaration(statement)) {
    return [statement.name.text];
  }
  return ts.isExportAssignment(statement) ? ["default"] : [];
};

const isExported = (statement: ts.Statement): boolean =>
  ts.canHaveModifiers(statement) &&
  (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

const exportedBy = (statement: ts.Statement): readonly string[] => {
  if (!ts.isExportDeclaration(statement)) {
    return isExported(statement) ? declaredBy(statement) : [];
  }
  const clause = statement.exportClause;
  if (clause === undefined) {
    return [`* from ${statement.moduleSpecifier?.getText() ?? ""}`];
  }
  return ts.isNamedExports(clause)
    ? clause.elements.map((element) => element.name.text)
    : [clause.name.text];
};

const isImport = (statement: ts.Statement): boolean =>
  ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement);

export const parseModule = (request: {
  readonly path: string;
  readonly text: string;
}): ts.SourceFile =>
  ts.createSourceFile(request.path, request.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

export const declaredNames = (source: ts.SourceFile): readonly string[] =>
  source.statements.flatMap(declaredBy);

export const typescriptModuleReader: ModuleReader = {
  shapeOf: (request): ModuleShape => {
    const source = parseModule(request);
    return {
      declarations: declaredNames(source),
      exports: source.statements.flatMap(exportedBy),
      statements: source.statements
        .filter((statement) => !isImport(statement))
        .map((statement) => statement.getText(source)),
    };
  },
};
