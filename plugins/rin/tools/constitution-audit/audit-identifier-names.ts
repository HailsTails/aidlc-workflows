import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditIdentifierNamesArgs = {
  readonly service: ServiceAuditConfig;
};

const SOURCE_FILE_SUFFIXES: readonly string[] = [".ts", ".tsx"];

const SNIPPET_MAX_LENGTH = 80;

const BANNED_SHORTHAND_NAMES: readonly string[] = [
  "c",
  "op",
  "s",
  "cb",
  "fn",
  "tx",
  "e",
  "ev",
  "acc",
  "item",
  "k",
  "v",
  "el",
  "arr",
  "i",
  "j",
  "n",
  "obj",
  "val",
  "res",
  "req",
  "tmp",
  "temp",
];

const BANNED_FILLER_NAMES: readonly string[] = [
  "object",
  "obj",
  "args",
  "arguments",
  "details",
  "extra",
  "extras",
  "data",
  "info",
  "params",
  "parameters",
  "props",
  "payload",
  "body",
  "value",
  "result",
  "stuff",
  "things",
  "misc",
  "metadata",
];

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

const classifyName = (
  identifierText: string,
): "shorthand" | "filler" | "ok" => {
  if (BANNED_SHORTHAND_NAMES.includes(identifierText)) {
    return "shorthand";
  }
  if (BANNED_FILLER_NAMES.includes(identifierText)) {
    return "filler";
  }
  return "ok";
};

const extractBindingIdentifiers = (
  binding: ts.BindingName,
): readonly ts.Identifier[] => {
  if (ts.isIdentifier(binding)) {
    return [binding];
  }
  if (ts.isObjectBindingPattern(binding) || ts.isArrayBindingPattern(binding)) {
    return binding.elements.flatMap((element) => {
      if (ts.isOmittedExpression(element)) {
        return [];
      }
      return extractBindingIdentifiers(element.name);
    });
  }
  return [];
};

const isExternallyMandatedUnused = (identifierText: string): boolean =>
  identifierText.startsWith("_");

const buildViolation = ({
  file,
  sourceFile,
  identifier,
  classification,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly identifier: ts.Identifier;
  readonly classification: "shorthand" | "filler";
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    identifier.getStart(sourceFile),
  );
  return {
    rule: `CD-6 (banned ${classification} name \`${identifier.text}\` — use a domain-prefixed compound)`,
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node: identifier }),
  };
};

const violationsFromBinding = ({
  file,
  sourceFile,
  binding,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly binding: ts.BindingName;
}): readonly ConstitutionViolation[] =>
  extractBindingIdentifiers(binding).flatMap((identifier) => {
    if (isExternallyMandatedUnused(identifier.text)) {
      return [];
    }
    const classification = classifyName(identifier.text);
    if (classification === "ok") {
      return [];
    }
    return [buildViolation({ file, sourceFile, identifier, classification })];
  });

const violationsFromNode = ({
  file,
  sourceFile,
  node,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
}): readonly ConstitutionViolation[] => {
  if (ts.isVariableDeclaration(node)) {
    return violationsFromBinding({ file, sourceFile, binding: node.name });
  }
  if (ts.isParameter(node)) {
    return violationsFromBinding({ file, sourceFile, binding: node.name });
  }
  if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
    if (isExternallyMandatedUnused(node.name.text)) {
      return [];
    }
    const classification = classifyName(node.name.text);
    if (classification === "ok") {
      return [];
    }
    return [
      buildViolation({
        file,
        sourceFile,
        identifier: node.name,
        classification,
      }),
    ];
  }
  return [];
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
    accumulated.push(...violationsFromNode({ file, sourceFile, node }));
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

const auditIdentifierNames = ({
  service,
}: AuditIdentifierNamesArgs): AuditConstitutionReport => {
  const srcSourceFiles = enumerateAuditableFiles(service.srcRoot);
  const uiSourceFiles = enumerateAuditableFiles(service.uiSrcRoot);
  const scannedFiles = [...srcSourceFiles, ...uiSourceFiles];
  const violations = scannedFiles.flatMap(auditFile);
  return { service, scannedFiles, violations };
};

export { type AuditIdentifierNamesArgs, auditIdentifierNames };
