import type { SyntaxApi, SyntaxNode, TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";

const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".integration.test.ts"] as const;

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

const violates = ({
  syntaxApi,
  node,
}: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): boolean => {
  if (
    syntaxApi.isIfStatement(node) ||
    syntaxApi.isTryStatement(node) ||
    syntaxApi.isConditionalExpression(node)
  )
    return true;
  if (
    syntaxApi.isVariableStatement(node) &&
    (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let
  )
    return true;
  if (!syntaxApi.isCallExpression(node) || !syntaxApi.isPropertyAccessExpression(node.expression))
    return false;
  const name = node.expression.name.text;
  return (
    BANNED_DYNAMIC_METHODS.includes(name) ||
    BANNED_MUTATION_METHODS.includes(name) ||
    name === "mockImplementation" ||
    (name === "fn" &&
      syntaxApi.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "vi" &&
      node.arguments.length > 0)
  );
};

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => {
    const findings: LocatedSnippet[] = [];
    const { syntaxApi } = repository;
    for (const file of repository.files.filter((path) =>
      TEST_SUFFIXES.some((suffix) => path.endsWith(suffix)),
    )) {
      const parsed = repository.parseFile({ file });
      if (parsed.outcome === "failed") return parsed;
      const { tree, source, nodes } = parsed.value;
      for (const node of nodes) {
        if (!violates({ syntaxApi, node })) continue;
        const position = node.getStart(tree);
        const { line, character } = tree.getLineAndCharacterOfPosition(position);
        const snippet = source.slice(position, position + 80).replace(/\n/g, " ");
        findings.push({
          file,
          anchor: { line: line + 1, column: character },
          snippet: snippet.length === 80 ? `${snippet}…` : snippet,
        });
      }
    }
    return { outcome: "ok", value: findings };
  },
};
