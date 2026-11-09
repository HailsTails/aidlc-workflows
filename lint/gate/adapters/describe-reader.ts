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
