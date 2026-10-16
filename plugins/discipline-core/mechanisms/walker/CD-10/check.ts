import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";

const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".integration.test.ts"] as const;

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
        if (!syntaxApi.isThrowStatement(node)) continue;
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
