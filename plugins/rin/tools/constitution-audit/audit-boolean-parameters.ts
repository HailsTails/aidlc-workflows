import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditBooleanParametersArgs = {
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

const isNullishLikeTypeNode = (memberType: ts.TypeNode): boolean => {
  if (memberType.kind === ts.SyntaxKind.UndefinedKeyword) {
    return true;
  }
  if (
    ts.isLiteralTypeNode(memberType) &&
    memberType.literal.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  return false;
};

const isBooleanLikeTypeNode = (typeNode: ts.TypeNode): boolean => {
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return true;
  }
  if (!ts.isUnionTypeNode(typeNode)) {
    return false;
  }
  const hasBooleanMember = typeNode.types.some(
    (memberType) => memberType.kind === ts.SyntaxKind.BooleanKeyword,
  );
  if (!hasBooleanMember) {
    return false;
  }
  return typeNode.types.every(
    (memberType) =>
      memberType.kind === ts.SyntaxKind.BooleanKeyword ||
      isNullishLikeTypeNode(memberType),
  );
};

type BooleanSite = "parameter" | "type-field" | "function-return";

const SITE_DESCRIPTIONS: Readonly<Record<BooleanSite, string>> = {
  parameter:
    "boolean parameter — booleans are evaluative; replace with a string-literal union or discriminated union",
  "type-field":
    "boolean type field — booleans are evaluative; replace with a string-literal union or discriminated union",
  "function-return":
    "boolean function return — booleans are evaluative; return a string-literal union or discriminated union (carve-out: type predicates `value is Foo`)",
};

const buildViolation = ({
  file,
  sourceFile,
  node,
  site,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
  readonly site: BooleanSite;
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    rule: `CD-43 (${SITE_DESCRIPTIONS[site]})`,
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node }),
  };
};

const isFunctionLikeWithReturnType = (
  node: ts.Node,
): node is ts.SignatureDeclaration => {
  if (
    !(
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isMethodSignature(node) ||
      ts.isFunctionTypeNode(node) ||
      ts.isConstructorTypeNode(node) ||
      ts.isCallSignatureDeclaration(node) ||
      ts.isConstructSignatureDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isIndexSignatureDeclaration(node)
    )
  ) {
    return false;
  }
  return node.type !== undefined;
};

const isAuthoredBooleanReturnType = (
  node: ts.SignatureDeclaration,
): boolean => {
  if (node.type === undefined) {
    return false;
  }
  if (ts.isTypePredicateNode(node.type)) {
    return false;
  }
  return isBooleanLikeTypeNode(node.type);
};

const collectFileViolations = ({
  file,
  sourceFile,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
}): readonly ConstitutionViolation[] => {
  const accumulated: ConstitutionViolation[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isParameter(node) &&
      node.type !== undefined &&
      isBooleanLikeTypeNode(node.type)
    ) {
      accumulated.push(
        buildViolation({ file, sourceFile, node, site: "parameter" }),
      );
    }
    if (
      ts.isPropertySignature(node) &&
      node.type !== undefined &&
      isBooleanLikeTypeNode(node.type)
    ) {
      accumulated.push(
        buildViolation({ file, sourceFile, node, site: "type-field" }),
      );
    }
    if (
      isFunctionLikeWithReturnType(node) &&
      isAuthoredBooleanReturnType(node)
    ) {
      accumulated.push(
        buildViolation({ file, sourceFile, node, site: "function-return" }),
      );
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

const auditBooleanParameters = ({
  service,
}: AuditBooleanParametersArgs): AuditConstitutionReport => {
  const srcSourceFiles = enumerateAuditableFiles(service.srcRoot);
  const uiSourceFiles = enumerateAuditableFiles(service.uiSrcRoot);
  const scannedFiles = [...srcSourceFiles, ...uiSourceFiles];
  const violations = scannedFiles.flatMap(auditFile);
  return { service, scannedFiles, violations };
};

export { type AuditBooleanParametersArgs, auditBooleanParameters };
