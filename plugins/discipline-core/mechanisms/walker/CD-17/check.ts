import type { RepoPath } from "../../../core/values/repo-path.ts";
import { inspectParsedFiles } from "../runner/legacy-source.ts";
import type { LocatedSnippet } from "../runner/walker-check.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";

type ConstitutionViolation = {
  readonly rule: string;
  readonly file: RepoPath;
  readonly line: number;
  readonly snippet: string;
};

const basename = (file: string): string => file.split(/[\\/]/).at(-1) ?? file;
const splitLines = (content: string): readonly string[] => content.split("\n");
const located = (finding: ConstitutionViolation): LocatedSnippet => ({
  file: finding.file,
  anchor: { line: Math.max(1, finding.line), column: 0 },
  snippet: finding.snippet,
});

export const check: TypeScriptWalkerCheck = {
  kind: "repository",
  inspect: ({ repository }) => inspectParsedFiles({
    repository,
    inspect: ({ file, parsed }) => {
      if (basename(file) === "audit-constitution.ts") {
        return [];
      }
      const checkBareDateConstruction = (
        filePath: RepoPath,
        content: string,
      ): readonly ConstitutionViolation[] =>
        splitLines(content)
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .filter(
            ({ line }) => /\bDate\.now\(\)/.test(line) || /\bnew Date\b/.test(line),
          )
          .map(({ line, lineNumber }) => ({
            rule: "CD-17",
            file: filePath,
            line: lineNumber,
            snippet: line.trim(),
          }));

      return ["App.tsx", "main.tsx"].includes(basename(file))
        ? []
        : checkBareDateConstruction(file, parsed.source).map(located);
    },
  }),
};
