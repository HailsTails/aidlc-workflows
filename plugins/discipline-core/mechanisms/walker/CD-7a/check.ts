import { inspectParsedFiles } from "../runner/legacy-source.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

type SourceLine = { readonly text: string; readonly number: number };
const trimSnippet = (raw: string): string => {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return collapsed.length > 80 ? `${collapsed.slice(0, 80)}…` : collapsed;
};
const sourceLines = (source: string): readonly SourceLine[] => source
  .split(/\r?\n/)
  .map((text, index) => ({ text, number: index + 1 }))
  .filter(({ text }) => !["//", "*", "/*"].some((prefix) => text.trim().startsWith(prefix)));

const PATTERNS: readonly RegExp[] = [/\bReturnType\s*<\s*typeof\b/];

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed }) => sourceLines(parsed.source).flatMap((line) =>
      PATTERNS.filter((pattern) => pattern.test(line.text)).map(() => ({
        file,
        anchor: { line: line.number, column: 0 },
        snippet: trimSnippet(line.text),
      })),
    ),
  }),
};
