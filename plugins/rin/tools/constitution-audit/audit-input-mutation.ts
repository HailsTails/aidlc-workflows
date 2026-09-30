import { readFileSync } from "node:fs";
import ts from "typescript";
import type {
  AuditConstitutionReport,
  ConstitutionViolation,
  ServiceAuditConfig,
} from "./audit-constitution.js";
import { walkSourceFiles } from "./walk-source-files.js";

type AuditInputMutationArgs = {
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

const extractBindingIdentifierNames = (
  binding: ts.BindingName,
): readonly string[] => {
  if (ts.isIdentifier(binding)) {
    return [binding.text];
  }
  if (ts.isObjectBindingPattern(binding) || ts.isArrayBindingPattern(binding)) {
    return binding.elements.flatMap((element) => {
      if (ts.isOmittedExpression(element)) {
        return [];
      }
      return extractBindingIdentifierNames(element.name);
    });
  }
  return [];
};

const collectParamNames = (
  functionLike: ts.SignatureDeclaration,
): ReadonlySet<string> => {
  const collected: string[] = [];
  functionLike.parameters.forEach((parameterNode) => {
    collected.push(...extractBindingIdentifierNames(parameterNode.name));
  });
  return new Set(collected);
};

const isFunctionLike = (node: ts.Node): node is ts.SignatureDeclaration =>
  ts.isFunctionDeclaration(node) ||
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isMethodDeclaration(node);

const leftmostIdentifierOfAccessChain = (
  expression: ts.Expression,
): string | undefined => {
  if (ts.isPropertyAccessExpression(expression)) {
    return leftmostIdentifierOfAccessChain(expression.expression);
  }
  if (ts.isElementAccessExpression(expression)) {
    return leftmostIdentifierOfAccessChain(expression.expression);
  }
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  return undefined;
};

const isInAnyScope = (
  scopeStack: readonly ReadonlySet<string>[],
  name: string,
): boolean => scopeStack.some((scope) => scope.has(name));

const isAccessChainAssignment = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) &&
  node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
  (ts.isPropertyAccessExpression(node.left) ||
    ts.isElementAccessExpression(node.left));

const isDeleteOnAccessChain = (node: ts.Node): node is ts.DeleteExpression => {
  if (!ts.isDeleteExpression(node)) {
    return false;
  }
  return (
    ts.isPropertyAccessExpression(node.expression) ||
    ts.isElementAccessExpression(node.expression)
  );
};

const MUTATING_METHOD_NAMES: readonly string[] = [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
];

const mutatingMethodNameOf = (
  callExpression: ts.CallExpression,
): string | undefined => {
  if (!ts.isPropertyAccessExpression(callExpression.expression)) {
    return undefined;
  }
  const methodName = callExpression.expression.name.text;
  if (!MUTATING_METHOD_NAMES.includes(methodName)) {
    return undefined;
  }
  return methodName;
};

const isMutatingMethodCall = (node: ts.Node): node is ts.CallExpression => {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }
  return mutatingMethodNameOf(node) !== undefined;
};

const buildFieldMutationViolation = ({
  file,
  sourceFile,
  node,
  paramName,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
  readonly paramName: string;
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    rule: `CD-44 (field mutation of parameter \`${paramName}\` — functions must not mutate fields of their inputs)`,
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node }),
  };
};

const buildMethodMutationViolation = ({
  file,
  sourceFile,
  node,
  paramName,
  methodName,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly node: ts.Node;
  readonly paramName: string;
  readonly methodName: string;
}): ConstitutionViolation => {
  const { line } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );
  return {
    rule: `CD-44 (mutating method \`.${methodName}\` called on parameter \`${paramName}\` — functions must not mutate their inputs)`,
    file,
    line: line + 1,
    snippet: snippetAt({ sourceFile, node }),
  };
};

type WalkerContext = {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
  readonly paramScopeStack: ReadonlySet<string>[];
  readonly accumulated: ConstitutionViolation[];
};

const checkFieldMutationAt = ({
  context,
  node,
  accessTarget,
}: {
  readonly context: WalkerContext;
  readonly node: ts.Node;
  readonly accessTarget: ts.Expression;
}): void => {
  const rootName = leftmostIdentifierOfAccessChain(accessTarget);
  if (rootName === undefined) {
    return;
  }
  if (!isInAnyScope(context.paramScopeStack, rootName)) {
    return;
  }
  context.accumulated.push(
    buildFieldMutationViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node,
      paramName: rootName,
    }),
  );
};

const checkMethodMutationAt = ({
  context,
  callExpression,
}: {
  readonly context: WalkerContext;
  readonly callExpression: ts.CallExpression;
}): void => {
  const methodName = mutatingMethodNameOf(callExpression);
  if (methodName === undefined) {
    return;
  }
  if (!ts.isPropertyAccessExpression(callExpression.expression)) {
    return;
  }
  const rootName = leftmostIdentifierOfAccessChain(
    callExpression.expression.expression,
  );
  if (rootName === undefined) {
    return;
  }
  if (!isInAnyScope(context.paramScopeStack, rootName)) {
    return;
  }
  context.accumulated.push(
    buildMethodMutationViolation({
      file: context.file,
      sourceFile: context.sourceFile,
      node: callExpression,
      paramName: rootName,
      methodName,
    }),
  );
};

const visitNode = ({
  context,
  node,
}: {
  readonly context: WalkerContext;
  readonly node: ts.Node;
}): void => {
  const enteringFunction = isFunctionLike(node);
  if (enteringFunction) {
    context.paramScopeStack.push(collectParamNames(node));
  }
  if (isAccessChainAssignment(node)) {
    checkFieldMutationAt({ context, node, accessTarget: node.left });
  }
  if (isDeleteOnAccessChain(node)) {
    checkFieldMutationAt({ context, node, accessTarget: node.expression });
  }
  if (isMutatingMethodCall(node)) {
    checkMethodMutationAt({ context, callExpression: node });
  }
  ts.forEachChild(node, (childNode) => visitNode({ context, node: childNode }));
  if (enteringFunction) {
    context.paramScopeStack.pop();
  }
};

const collectFileViolations = ({
  file,
  sourceFile,
}: {
  readonly file: string;
  readonly sourceFile: ts.SourceFile;
}): readonly ConstitutionViolation[] => {
  const context: WalkerContext = {
    file,
    sourceFile,
    paramScopeStack: [],
    accumulated: [],
  };
  visitNode({ context, node: sourceFile });
  return context.accumulated;
};

const parseSourceFile = (file: string): ts.SourceFile => {
  const text = readFileSync(file, "utf-8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
};

const auditFile = (file: string): readonly ConstitutionViolation[] =>
  collectFileViolations({ file, sourceFile: parseSourceFile(file) });

const auditInputMutation = ({
  service,
}: AuditInputMutationArgs): AuditConstitutionReport => {
  const srcSourceFiles = enumerateAuditableFiles(service.srcRoot);
  const uiSourceFiles = enumerateAuditableFiles(service.uiSrcRoot);
  const scannedFiles = [...srcSourceFiles, ...uiSourceFiles];
  const violations = scannedFiles.flatMap(auditFile);
  return { service, scannedFiles, violations };
};

export { type AuditInputMutationArgs, auditInputMutation };
