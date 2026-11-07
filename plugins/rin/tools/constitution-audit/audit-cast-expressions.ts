import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditCastExpressionsArgs = {
  readonly service: ServiceAuditConfig;
};

const SOURCE_FILE_SUFFIXES: readonly string[] = [".ts", ".tsx"];

const SNIPPET_MAX_LENGTH = 80;

const isAuditableSourceFile = (filePath: string): boolean =>
  SOURCE_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));

const enumerateAuditableFiles = (rootDir: string): readonly string[] =>
  walkSourceFiles({ rootDir }).filter(isAuditableSourceFile);

const snippetAt = ({
  sourceFile,
  node,
}: {
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
}): string => {
  const startOffset = node.getStart(sourceFile);
  const rawSnippet = sourceFile.text
    .slice(startOffset, startOffset + SNIPPET_MAX_LENGTH)
    .replace(/\n/g, " ");
  return rawSnippet.length === SNIPPET_MAX_LENGTH
    ? `${rawSnippet}…`
    : rawSnippet;
};

const isUnknownTypeNode = (typeNode: ts.TypeNode): boolean =>
  typeNode.kind === ts.SyntaxKind.UnknownKeyword;

const isConstAssertionTypeNode = (typeNode: ts.TypeNode): boolean => {
  if (!ts.isTypeReferenceNode(typeNode)) {
    return false;
  }
  if (!ts.isIdentifier(typeNode.typeName)) {
    return false;
  }
  return typeNode.typeName.text === "const";
};

const ZOD_MODULE_SPECIFIER_PATTERN = /^zod(\/.*)?$/;

const namesImportedFromZod = (
  sourceFile: ts.SourceFile,
): ReadonlySet<string> => {
  const imported = new Set<string>();
  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) {
      return;
    }
    if (!ts.isStringLiteral(statement.moduleSpecifier)) {
      return;
    }
    if (!ZOD_MODULE_SPECIFIER_PATTERN.test(statement.moduleSpecifier.text)) {
      return;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (namedBindings === undefined || !ts.isNamedImports(namedBindings)) {
      return;
    }
    namedBindings.elements.forEach((element) => {
      imported.add(element.name.text);
    });
  });
  return imported;
};

const isZodIntrospectionTypeNode = ({
  typeNode,
  zodImportedNames,
}: {
  readonly typeNode: ts.TypeNode;
  readonly zodImportedNames: ReadonlySet<string>;
}): boolean => {
  if (!ts.isTypeReferenceNode(typeNode)) {
    return false;
  }
  if (!ts.isIdentifier(typeNode.typeName)) {
    return false;
  }
  return zodImportedNames.has(typeNode.typeName.text);
};

const isToolInputSchemaTypeNode = (typeNode: ts.TypeNode): boolean => {
  if (!ts.isIndexedAccessTypeNode(typeNode)) {
    return false;
  }
  const objectType = typeNode.objectType;
  if (!ts.isTypeReferenceNode(objectType)) {
    return false;
  }
  if (!ts.isIdentifier(objectType.typeName)) {
    return false;
  }
  if (objectType.typeName.text !== "Tool") {
    return false;
  }
  const indexType = typeNode.indexType;
  if (!ts.isLiteralTypeNode(indexType)) {
    return false;
  }
  if (!ts.isStringLiteral(indexType.literal)) {
    return false;
  }
  return indexType.literal.text === "inputSchema";
};

const isSqliteRowArrayCast = ({
  expression,
  typeNode,
}: {
  readonly expression: ts.Expression;
  readonly typeNode: ts.TypeNode;
}): boolean => {
  if (!ts.isPropertyAccessExpression(expression)) {
    return false;
  }
  if (expression.name.text !== "value") {
    return false;
  }
  if (!ts.isTypeReferenceNode(typeNode)) {
    return false;
  }
  if (!ts.isIdentifier(typeNode.typeName)) {
    return false;
  }
  const typeName = typeNode.typeName.text;
  return typeName === "ReadonlyArray" || typeName === "Array";
};

const isPermittedAsExpression = ({
  node,
  zodImportedNames,
}: {
  readonly node: ts.AsExpression;
  readonly zodImportedNames: ReadonlySet<string>;
}): boolean => {
  const typeNode = node.type;
  if (isUnknownTypeNode(typeNode)) {
    return true;
  }
  if (isConstAssertionTypeNode(typeNode)) {
    return true;
  }
  if (isZodIntrospectionTypeNode({ typeNode, zodImportedNames })) {
    return true;
  }
  if (isToolInputSchemaTypeNode(typeNode)) {
    return true;
  }
  if (isSqliteRowArrayCast({ expression: node.expression, typeNode })) {
    return true;
  }
  return false;
};

const buildViolation = ({
  file,
  sourceFile,
  node,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    rule: 'CD-2 (cast outside the 3 permitted contexts — Zod `_def` introspection, better-sqlite3 row narrow, zodToJsonSchema → Tool["inputSchema"])',
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node }),
  };
};

const collectFileViolations = ({
  file,
  sourceFile,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
}): readonly ConstitutionViolation[] => {
  const accumulated: ConstitutionViolation[] = [];
  const zodImportedNames = namesImportedFromZod(sourceFile);
  const visit = (node: ts.Node): void => {
    if (
      ts.isAsExpression(node) &&
      !isPermittedAsExpression({ node, zodImportedNames })
    ) {
      accumulated.push(buildViolation({ file, sourceFile, node }));
    }
    if (ts.isTypeAssertionExpression(node)) {
      accumulated.push(buildViolation({ file, sourceFile, node }));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return accumulated;
};

const parseSourceFile = (file: string): ts.SourceFile => {
  const text = readFileSync(file, "utf-8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
};

const auditFile = (file: string): readonly ConstitutionViolation[] =>
  collectFileViolations({ file, sourceFile: parseSourceFile(file) });

const auditCastExpressions = ({
  service,
}: AuditCastExpressionsArgs): AuditConstitutionReport => {
  const srcSourceFiles = enumerateAuditableFiles(service.srcRoot);
  const uiSourceFiles = enumerateAuditableFiles(service.uiSrcRoot);
  const scannedFiles = [...srcSourceFiles, ...uiSourceFiles];
  const violations = scannedFiles.flatMap(auditFile);
  return { service, scannedFiles, violations };
};

export { type AuditCastExpressionsArgs, auditCastExpressions };
