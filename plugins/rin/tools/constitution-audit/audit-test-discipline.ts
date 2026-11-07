import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditTestDisciplineArgs = {
  readonly service: ServiceAuditConfig;
};

const TEST_FILE_SUFFIXES: readonly string[] = [
  ".test.ts",
  ".test.tsx",
  ".integration.test.ts",
];

const BANNED_DYNAMIC_METHODS: readonly string[] = [
  "at",
  "charAt",
  "charCodeAt",
  "codePointAt",
  "concat",
  "endsWith",
  "entries",
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flat",
  "flatMap",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "keys",
  "lastIndexOf",
  "localeCompare",
  "map",
  "match",
  "matchAll",
  "normalize",
  "padEnd",
  "padStart",
  "reduce",
  "reduceRight",
  "repeat",
  "replace",
  "replaceAll",
  "search",
  "slice",
  "some",
  "sort",
  "split",
  "startsWith",
  "substr",
  "substring",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toReversed",
  "toSorted",
  "toSpliced",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
  "values",
  "with",
];

const BANNED_MUTATION_METHODS: readonly string[] = [
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "splice",
  "unshift",
];

const SNIPPET_MAX_LENGTH = 80;

const isTestFile = (filePath: string): boolean =>
  TEST_FILE_SUFFIXES.some((suffix) => filePath.endsWith(suffix));

const walkTestFiles = (rootDir: string): readonly string[] =>
  walkSourceFiles({ rootDir }).filter(isTestFile);

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

const buildViolation = ({
  file,
  sourceFile,
  node,
  rule,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
  readonly rule: string;
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    rule,
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node }),
  };
};

const propertyAccessMethodName = (
  callExpression: ts.CallExpression,
): string | undefined => {
  if (!ts.isPropertyAccessExpression(callExpression.expression)) {
    return undefined;
  }
  return callExpression.expression.name.text;
};

const matchesViMember = ({
  callExpression,
  memberName,
}: {
  readonly callExpression: ts.CallExpression;
  readonly memberName: string;
}): boolean => {
  const callee = callExpression.expression;
  if (!ts.isPropertyAccessExpression(callee)) {
    return false;
  }
  if (callee.name.text !== memberName) {
    return false;
  }
  if (!ts.isIdentifier(callee.expression)) {
    return false;
  }
  return callee.expression.text === "vi";
};

const matchesViFnWithImplementation = (
  callExpression: ts.CallExpression,
): boolean => {
  if (!matchesViMember({ callExpression, memberName: "fn" })) {
    return false;
  }
  return callExpression.arguments.length > 0;
};

const matchesMockImplementationCall = (
  callExpression: ts.CallExpression,
): boolean => {
  if (!ts.isPropertyAccessExpression(callExpression.expression)) {
    return false;
  }
  return callExpression.expression.name.text === "mockImplementation";
};

const matchesViMockCall = (callExpression: ts.CallExpression): boolean =>
  matchesViMember({ callExpression, memberName: "mock" });

type CallSiteContext = {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly callExpression: ts.CallExpression;
};

const dynamicMethodViolation = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => {
  const methodName = propertyAccessMethodName(context.callExpression);
  if (
    methodName === undefined ||
    !BANNED_DYNAMIC_METHODS.includes(methodName)
  ) {
    return [];
  }
  return [
    buildViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: context.callExpression,
      rule: `CD-27 (no \`.${methodName}\` dynamic operation in tests — use hardcoded data)`,
    }),
  ];
};

const mutationMethodViolation = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => {
  const methodName = propertyAccessMethodName(context.callExpression);
  if (
    methodName === undefined ||
    !BANNED_MUTATION_METHODS.includes(methodName)
  ) {
    return [];
  }
  return [
    buildViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: context.callExpression,
      rule: `CD-27 (no \`.${methodName}\` mutation in tests)`,
    }),
  ];
};

const viMockViolation = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => {
  if (!matchesViMockCall(context.callExpression)) {
    return [];
  }
  return [
    buildViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: context.callExpression,
      rule: "CD-26 (no `vi.mock` — DI is wrong; inject the port)",
    }),
  ];
};

const viFnImplViolation = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => {
  if (!matchesViFnWithImplementation(context.callExpression)) {
    return [];
  }
  return [
    buildViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: context.callExpression,
      rule: "CD-25/27 (no implementation arg to `vi.fn` — use `mockReturnValue`/`mockResolvedValue`/`mockReturnValueOnce`)",
    }),
  ];
};

const mockImplViolation = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => {
  if (!matchesMockImplementationCall(context.callExpression)) {
    return [];
  }
  return [
    buildViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: context.callExpression,
      rule: "CD-25/27 (no `.mockImplementation` — use `mockReturnValue`/`mockResolvedValue`/`mockReturnValueOnce`)",
    }),
  ];
};

const callExpressionViolations = (
  context: CallSiteContext,
): readonly ConstitutionViolation[] => [
  ...dynamicMethodViolation(context),
  ...mutationMethodViolation(context),
  ...viMockViolation(context),
  ...viFnImplViolation(context),
  ...mockImplViolation(context),
];

const structuralViolation = ({
  file,
  sourceFile,
  node,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
}): readonly ConstitutionViolation[] => {
  if (ts.isIfStatement(node)) {
    return [
      buildViolation({
        file,
        sourceFile,
        node,
        rule: "CD-27 (no `if` in tests)",
      }),
    ];
  }
  if (ts.isTryStatement(node)) {
    return [
      buildViolation({
        file,
        sourceFile,
        node,
        rule: "CD-27 (no `try`/`catch` in tests)",
      }),
    ];
  }
  if (ts.isThrowStatement(node)) {
    return [
      buildViolation({
        file,
        sourceFile,
        node,
        rule: "CD-10 (no `throw` in tests — use vitest matchers)",
      }),
    ];
  }
  if (ts.isConditionalExpression(node)) {
    return [
      buildViolation({
        file,
        sourceFile,
        node,
        rule: "CD-27 (no ternary `?:` in tests)",
      }),
    ];
  }
  if (ts.isVariableStatement(node)) {
    const isLet =
      (node.declarationList.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let;
    if (isLet) {
      return [
        buildViolation({
          file,
          sourceFile,
          node,
          rule: "CD-27 (no `let`-mutation in tests)",
        }),
      ];
    }
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
    accumulated.push(...structuralViolation({ file, sourceFile, node }));
    if (ts.isCallExpression(node)) {
      accumulated.push(
        ...callExpressionViolations({ file, sourceFile, callExpression: node }),
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

const auditTestDiscipline = ({
  service,
}: AuditTestDisciplineArgs): AuditConstitutionReport => {
  const srcTestFiles = walkTestFiles(service.srcRoot);
  const uiTestFiles = walkTestFiles(service.uiSrcRoot);
  const scriptsTestFiles = walkTestFiles(service.scriptsRoot);
  const scannedFiles = [...srcTestFiles, ...uiTestFiles, ...scriptsTestFiles];
  const violations = scannedFiles.flatMap(auditFile);
  return { service, scannedFiles, violations };
};

export { type AuditTestDisciplineArgs, auditTestDiscipline };
