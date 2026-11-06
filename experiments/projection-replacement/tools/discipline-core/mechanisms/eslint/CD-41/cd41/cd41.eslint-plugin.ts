import type { AST, Rule, SourceCode } from "../../runner/eslint-instance.ts";

type FunctionScore = { readonly node: Rule.Node; readonly score: number };

type WalkedScore = { readonly own: number; readonly nested: readonly FunctionScore[] };

type Walk = {
  readonly node: Rule.Node;
  readonly parent: Rule.Node | undefined;
  readonly nesting: number;
  readonly sourceCode: SourceCode;
};

type LogicalRun = "starts-run" | "continues-run";

const MAX_COGNITIVE_COMPLEXITY = 15;

const MAX_FUNCTION_LINES = 50;

const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

const LOOP_TYPES: ReadonlySet<string> = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);

const LOOP_BODY_KEYS: ReadonlySet<string> = new Set(["body"]);

const ACCESSOR_KINDS: ReadonlySet<string> = new Set(["get", "set"]);

const MEMBER_TYPES: ReadonlySet<string> = new Set(["MethodDefinition", "Property", "TSAbstractMethodDefinition"]);

const BRACES: ReadonlySet<string> = new Set(["{", "}"]);

const LINE_BREAK = /\r\n|[\r\n]/gu;

const EMPTY: WalkedScore = { own: 0, nested: [] };

const isNode = (candidate: unknown): candidate is Rule.Node =>
  typeof candidate === "object" && candidate !== null && "type" in candidate && typeof candidate.type === "string";

const childNodesOf = (request: { readonly node: Rule.Node; readonly sourceCode: SourceCode; readonly keys?: ReadonlySet<string> }): readonly { readonly key: string; readonly child: Rule.Node }[] =>
  (request.sourceCode.visitorKeys[request.node.type] ?? [])
    .filter((key) => request.keys === undefined || request.keys.has(key))
    .flatMap((key) => {
      const field: unknown = Reflect.get(request.node, key);
      const fieldEntries: readonly unknown[] = Array.isArray(field) ? field : [field];
      return fieldEntries.filter(isNode).map((child) => ({ key, child }));
    });

const combined = (request: { readonly scores: readonly WalkedScore[] }): WalkedScore =>
  request.scores.reduce<WalkedScore>(
    (total, next) => ({ own: total.own + next.own, nested: [...total.nested, ...next.nested] }),
    EMPTY,
  );

const withOwn = (request: { readonly score: WalkedScore; readonly increment: number }): WalkedScore => ({
  own: request.score.own + request.increment,
  nested: request.score.nested,
});

const walkedChildren = (request: Walk & { readonly nestedKeys?: ReadonlySet<string> }): WalkedScore =>
  combined({
    scores: childNodesOf({ node: request.node, sourceCode: request.sourceCode }).map(({ key, child }) =>
      walked({
        node: child,
        parent: request.node,
        nesting: request.nestedKeys?.has(key) ? request.nesting + 1 : request.nesting,
        sourceCode: request.sourceCode,
      }),
    ),
  });

const parenthesisation = (request: { readonly node: Rule.Node; readonly parent: Rule.Node; readonly sourceCode: SourceCode }): "parenthesised" | "bare" => {
  const before = request.sourceCode.getTokenBefore(request.node);
  const after = request.sourceCode.getTokenAfter(request.node);
  return before?.value === "(" && after?.value === ")" && before.range[0] >= (request.parent.range?.[0] ?? 0)
    ? "parenthesised"
    : "bare";
};

const logicalRun = (request: Walk): LogicalRun => {
  const parent = request.parent;
  if (
    request.node.type !== "LogicalExpression" ||
    parent?.type !== "LogicalExpression" ||
    parent.operator !== request.node.operator ||
    parent.left !== request.node
  ) {
    return "starts-run";
  }
  return parenthesisation({ node: request.node, parent, sourceCode: request.sourceCode }) === "parenthesised"
    ? "starts-run"
    : "continues-run";
};

const childNamed = (request: { readonly node: Rule.Node; readonly key: string; readonly sourceCode: SourceCode }): Rule.Node | undefined =>
  childNodesOf({ node: request.node, sourceCode: request.sourceCode, keys: new Set([request.key]) }).at(0)?.child;

const walkedChild = (request: Walk & { readonly key: string; readonly deeper: number }): WalkedScore => {
  const child = childNamed({ node: request.node, key: request.key, sourceCode: request.sourceCode });
  return child === undefined
    ? EMPTY
    : walked({ node: child, parent: request.node, nesting: request.nesting + request.deeper, sourceCode: request.sourceCode });
};

const walkedElse = (request: Walk): WalkedScore => {
  const alternate = childNamed({ node: request.node, key: "alternate", sourceCode: request.sourceCode });
  if (alternate === undefined) {
    return EMPTY;
  }
  if (alternate.type === "IfStatement") {
    return walkedIf({ ...request, node: alternate, parent: request.node });
  }
  return withOwn({
    score: walked({ node: alternate, parent: request.node, nesting: request.nesting + 1, sourceCode: request.sourceCode }),
    increment: 1,
  });
};

const walkedIf = (request: Walk): WalkedScore =>
  withOwn({
    score: combined({
      scores: [
        walkedChild({ ...request, key: "test", deeper: 0 }),
        walkedChild({ ...request, key: "consequent", deeper: 1 }),
        walkedElse(request),
      ],
    }),
    increment: 1 + request.nesting,
  });

const NESTING_STRUCTURES: Readonly<Record<string, ReadonlySet<string>>> = {
  SwitchStatement: new Set(["cases"]),
  ConditionalExpression: new Set(["consequent", "alternate"]),
  CatchClause: new Set(["body"]),
};

const structureIncrement = (request: Walk): number => {
  const node = request.node;
  if (node.type === "LogicalExpression") {
    return logicalRun(request) === "starts-run" ? 1 : 0;
  }
  if ((node.type === "BreakStatement" || node.type === "ContinueStatement") && (node.label ?? null) !== null) {
    return 1;
  }
  return node.type === "WithStatement" ? 1 : 0;
};

const walkedTry = (request: Walk): WalkedScore => {
  if (request.node.type !== "TryStatement" || request.node.finalizer === null || request.node.finalizer === undefined) {
    return walkedChildren(request);
  }
  return withOwn({ score: walkedChildren(request), increment: 1 });
};

const walked = (request: Walk): WalkedScore => {
  const node = request.node;
  if (FUNCTION_TYPES.has(node.type)) {
    const nested = scoredFunction({ node, nesting: request.nesting + 1, sourceCode: request.sourceCode });
    return { own: 0, nested: [{ node, score: nested.own }, ...nested.nested] };
  }
  if (node.type === "IfStatement") {
    return walkedIf(request);
  }
  if (node.type === "TryStatement") {
    return walkedTry(request);
  }
  const nestedKeys = LOOP_TYPES.has(node.type) ? LOOP_BODY_KEYS : NESTING_STRUCTURES[node.type];
  if (nestedKeys !== undefined) {
    return withOwn({ score: walkedChildren({ ...request, nestedKeys }), increment: 1 + request.nesting });
  }
  return withOwn({ score: walkedChildren(request), increment: structureIncrement(request) });
};

const scoredFunction = (request: {
  readonly node: Rule.Node;
  readonly nesting: number;
  readonly sourceCode: SourceCode;
}): WalkedScore => walkedChildren({ ...request, parent: request.node.parent ?? undefined });

const memberKeyOf = (request: { readonly node: Rule.Node }): Rule.Node | undefined => {
  const parent = request.node.parent;
  if (parent === null || !MEMBER_TYPES.has(parent.type) || !("key" in parent) || !isNode(parent.key)) {
    return undefined;
  }
  return parent.value === request.node ? parent.key : undefined;
};

const functionNameLoc = (request: { readonly node: Rule.Node; readonly sourceCode: SourceCode }): AST.SourceLocation | undefined => {
  const node = request.node;
  const named = "id" in node && isNode(node.id) ? node.id : memberKeyOf({ node });
  if (named?.loc) {
    return named.loc;
  }
  if (node.type === "ArrowFunctionExpression") {
    return request.sourceCode.getTokenBefore(node.body, { filter: (token) => token.value === "=>" })?.loc;
  }
  return request.sourceCode.getFirstToken(node)?.loc;
};

const accessorDisposition = (request: { readonly node: Rule.Node }): "accessor" | "callable" => {
  const parent = request.node.parent;
  return parent !== null && MEMBER_TYPES.has(parent.type) && "kind" in parent && ACCESSOR_KINDS.has(String(parent.kind))
    ? "accessor"
    : "callable";
};

const functionLineCount = (request: { readonly body: Rule.Node; readonly sourceCode: SourceCode }): number =>
  request.sourceCode
    .getTokens(request.body)
    .filter((token) => !(token.type === "Punctuator" && BRACES.has(token.value)))
    .reduce((lines, token) => {
      const previous = request.sourceCode.getTokenBefore(token);
      const triviaStart = previous === null ? token.range[0] : previous.range[1];
      return lines + (request.sourceCode.text.slice(triviaStart, token.range[0]).match(LINE_BREAK)?.length ?? 0);
    }, 0);

const cognitiveComplexity: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Limit each function's cognitive complexity to 15 (CD-41)" },
    schema: [],
    messages: {
      cognitiveComplexity:
        "CD-41: this function's cognitive complexity is {{score}}, above the limit of {{max}}; move the branching into helpers it composes.",
    },
  },
  create: (context) => {
    const reportScored = (scored: FunctionScore): void => {
      const loc = functionNameLoc({ node: scored.node, sourceCode: context.sourceCode });
      if (loc === undefined) {
        return;
      }
      context.report({
        loc,
        messageId: "cognitiveComplexity",
        data: { score: String(scored.score), max: String(MAX_COGNITIVE_COMPLEXITY) },
      });
    };
    const scoreOutermost = (node: Rule.Node): void => {
      if (context.sourceCode.getAncestors(node).some((ancestor) => FUNCTION_TYPES.has(ancestor.type))) {
        return;
      }
      const scored = scoredFunction({ node, nesting: 0, sourceCode: context.sourceCode });
      [{ node, score: scored.own }, ...scored.nested]
        .filter((entry) => entry.score > MAX_COGNITIVE_COMPLEXITY)
        .forEach(reportScored);
    };
    return {
      FunctionDeclaration: scoreOutermost,
      FunctionExpression: scoreOutermost,
      ArrowFunctionExpression: scoreOutermost,
    };
  },
};

const reportLongFunction = (request: { readonly context: Rule.RuleContext; readonly node: Rule.Node }): void => {
  if (accessorDisposition({ node: request.node }) === "accessor" || !("body" in request.node) || !isNode(request.node.body)) {
    return;
  }
  const lines = functionLineCount({ body: request.node.body, sourceCode: request.context.sourceCode });
  if (lines <= MAX_FUNCTION_LINES) {
    return;
  }
  request.context.report({
    node: request.node,
    messageId: "functionLength",
    data: { lines: String(lines), max: String(MAX_FUNCTION_LINES) },
  });
};

const functionLength: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: { description: "Limit each function body to 50 lines (CD-41)" },
    schema: [],
    messages: {
      functionLength: "CD-41: this function body has {{lines}} lines, above the limit of {{max}}; split it into helpers.",
    },
  },
  create: (context) => ({
    FunctionDeclaration: (node) => reportLongFunction({ context, node }),
    FunctionExpression: (node) => reportLongFunction({ context, node }),
    ArrowFunctionExpression: (node) => reportLongFunction({ context, node }),
  }),
};

export default {
  meta: { name: "discipline-cd41", version: "0.0.0-local" },
  rules: {
    "cognitive-complexity": cognitiveComplexity,
    "function-length": functionLength,
  },
};
