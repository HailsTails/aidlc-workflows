import type { Rule } from "../../runner/eslint-instance.ts";

type ThrownExpression = {
  readonly type: string;
  readonly name?: string;
  readonly left?: ThrownExpression;
  readonly right?: ThrownExpression;
  readonly consequent?: ThrownExpression;
  readonly alternate?: ThrownExpression;
  readonly expressions?: readonly ThrownExpression[];
};

type ThrownDisposition = "non-error" | "possibly-error";

const NON_ERROR_EXPRESSIONS: ReadonlySet<string> = new Set([
  "Literal",
  "ObjectExpression",
  "BinaryExpression",
  "TemplateLiteral",
  "TaggedTemplateExpression",
]);

const eitherNonError = (request: {
  readonly first: ThrownExpression | undefined;
  readonly second: ThrownExpression | undefined;
}): ThrownDisposition =>
  thrownDisposition({ expression: request.first }) === "non-error" ||
  thrownDisposition({ expression: request.second }) === "non-error"
    ? "non-error"
    : "possibly-error";

const COMPOSITE_DISPOSITIONS: Readonly<Record<string, (expression: ThrownExpression) => ThrownDisposition>> = {
  LogicalExpression: (expression) => eitherNonError({ first: expression.left, second: expression.right }),
  ConditionalExpression: (expression) =>
    eitherNonError({ first: expression.consequent, second: expression.alternate }),
  AssignmentExpression: (expression) => thrownDisposition({ expression: expression.right }),
  SequenceExpression: (expression) => thrownDisposition({ expression: expression.expressions?.at(-1) }),
};

const thrownDisposition = (request: { readonly expression: ThrownExpression | undefined }): ThrownDisposition => {
  if (request.expression === undefined) {
    return "possibly-error";
  }
  if (NON_ERROR_EXPRESSIONS.has(request.expression.type)) {
    return "non-error";
  }
  if (request.expression.type === "Identifier") {
    return request.expression.name === "undefined" ? "non-error" : "possibly-error";
  }
  const composite = COMPOSITE_DISPOSITIONS[request.expression.type];
  return composite === undefined ? "possibly-error" : composite(request.expression);
};

const throwOnlyError: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow throwing values that cannot be Error objects (CD-10)" },
    schema: [],
    messages: {
      throwOnlyError: "CD-10: throw an Error, not a literal, object, template or undefined.",
    },
  },
  create: (context) => ({
    ThrowStatement: (node) => {
      if (thrownDisposition({ expression: node.argument }) === "possibly-error") {
        return;
      }
      context.report({ node, messageId: "throwOnlyError" });
    },
  }),
};

export default {
  meta: { name: "discipline-cd10", version: "0.0.0-local" },
  rules: { "throw-only-error": throwOnlyError },
};
