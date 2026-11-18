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

const literalsIn = (node: ts.Node): readonly ts.TypeLiteralNode[] =>
  ts.isTypeLiteralNode(node) ? [node] : node.getChildren().flatMap(literalsIn);

const memberName = (member: ts.TypeElement): readonly string[] =>
  member.name === undefined ? [] : [member.name.getText()];

const membersOfNamed = (source: ts.SourceFile, type: string): readonly string[] =>
  source.statements.flatMap((statement) => {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === type) {
      return statement.members.flatMap(memberName);
    }
    return ts.isTypeAliasDeclaration(statement) && statement.name.text === type
      ? literalsIn(statement.type).flatMap((literal) => literal.members.flatMap(memberName))
      : [];
  });

const PLATFORM_GLOBALS = new Set(["Bun", "process", "require", "fetch"]);

const DYNAMIC_IMPORT = "import()";

const bindingsAreAllTypes = (clause: ts.ImportClause | undefined): boolean => {
  if (clause === undefined) {
    return false;
  }
  const named = clause.namedBindings;
  const onlyNamed = clause.name === undefined && named !== undefined && ts.isNamedImports(named);
  return clause.isTypeOnly || (onlyNamed && named.elements.every((element) => element.isTypeOnly));
};

const isTypeOnlyModuleReference = (node: ts.Node): boolean =>
  (ts.isImportDeclaration(node) && bindingsAreAllTypes(node.importClause)) ||
  (ts.isExportDeclaration(node) && node.isTypeOnly);

const specifierOf = (node: ts.Node): readonly string[] => {
  const isModuleSpecifier =
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteralLike(node.moduleSpecifier) &&
    !isTypeOnlyModuleReference(node);
  return isModuleSpecifier ? [(node.moduleSpecifier as ts.StringLiteralLike).text] : [];
};

const isDynamicImport = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;

const dynamicSpecifier = (call: ts.CallExpression): readonly string[] => {
  const [first] = call.arguments;
  return first !== undefined && ts.isStringLiteralLike(first) ? [first.text] : [];
};

const isPlatformIdentifier = (node: ts.Node): node is ts.Identifier =>
  ts.isIdentifier(node) &&
  PLATFORM_GLOBALS.has(node.text) &&
  !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node);

const referencesIn = (node: ts.Node): { imports: string[]; globals: string[] } => {
  const own = {
    imports: [...specifierOf(node), ...(isDynamicImport(node) ? dynamicSpecifier(node) : [])],
    globals: [
      ...(isDynamicImport(node) ? [DYNAMIC_IMPORT] : []),
      ...(isPlatformIdentifier(node) ? [node.text] : []),
    ],
  };
  const children = node.getChildren().map(referencesIn);
  return {
    imports: [...own.imports, ...children.flatMap((child) => child.imports)],
    globals: [...own.globals, ...children.flatMap((child) => child.globals)],
  };
};

export const typescriptModuleReader: ModuleReader = {
  referencesOf: (request) => {
    const found = referencesIn(parseModule(request));
    return { imports: found.imports, globals: [...new Set(found.globals)] };
  },
  membersOf: (request) => membersOfNamed(parseModule(request), request.type),
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
