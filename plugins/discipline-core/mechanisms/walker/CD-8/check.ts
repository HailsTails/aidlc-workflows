import { inspectParsedFiles } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
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

type SwitchFold = { readonly depth: number; readonly findings: readonly LocatedSnippet[] };

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed }) => sourceLines(parsed.source).reduce<SwitchFold>((collected, line) => {
      const opens = (line.text.match(/\bswitch\s*\(/g) ?? []).length;
      const closes = (line.text.match(/\}/g) ?? []).length;
      const matched = collected.depth + opens > 0 && /(^|[^.\w])default\s*:/.test(line.text);
      return {
        depth: Math.max(0, collected.depth + opens - closes),
        findings: matched ? [...collected.findings, {
          file,
          anchor: { line: line.number, column: 0 },
          snippet: trimSnippet(line.text),
        }] : collected.findings,
      };
    }, { depth: 0, findings: [] }).findings,
  }),
};
