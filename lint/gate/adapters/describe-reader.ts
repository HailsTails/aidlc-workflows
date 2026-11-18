import * as ts from "typescript";

const DESCRIBE_CALLEES = new Set(["describe"]);

const topLevelDescribeName = (statement: ts.Statement): string | undefined => {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
    return undefined;
  }
  const { expression, arguments: callArguments } = statement.expression;
  const first = callArguments[0];
  const isDescribe = ts.isIdentifier(expression) && DESCRIBE_CALLEES.has(expression.text);
  const named = first !== undefined && ts.isStringLiteralLike(first);
  return isDescribe && named ? first.text : undefined;
};

export const topLevelDescribes = (source: string): readonly string[] => {
  const file = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, false);
  return file.statements.flatMap((statement) => {
    const name = topLevelDescribeName(statement);
    return name === undefined ? [] : [name];
  });
};

const REGISTERING_ROOTS = new Set(["describe", "test", "it"]);

const rootIdentifier = (expression: ts.Expression): string | undefined => {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return rootIdentifier(expression.expression);
  }
  return ts.isCallExpression(expression) ? rootIdentifier(expression.expression) : undefined;
};

const registersTests = (node: ts.Node): boolean =>
  (ts.isCallExpression(node) && REGISTERING_ROOTS.has(rootIdentifier(node.expression) ?? "")) ||
  node.getChildren().some(registersTests);

export const hasTestsOutsideNamedDescribes = (source: string): boolean => {
  const file = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
  return file.statements.some(
    (statement) => topLevelDescribeName(statement) === undefined && registersTests(statement),
  );
};
