import type ts from "typescript";
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
    inspect: ({ file, parsed, syntaxApi: ts }) => {
      if (basename(file) === "audit-constitution.ts") {
        return [];
      }
      const BARE_TODO_PATTERN = /\/\/\s*TODO\b(?!\s*\()/;



      const BARE_TS_EXPECT_ERROR_PATTERN =
        /\/\/\s*@ts-expect-error\b(?!.*\(spec-\d+\))/;

      const checkBareTodoAnnotation = (
        filePath: RepoPath,
        content: string,
      ): readonly ConstitutionViolation[] =>
        splitLines(content)
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .filter(({ line }) => BARE_TODO_PATTERN.test(line))
          .map(({ line, lineNumber }) => ({
            rule: "CD-5 (bare `// TODO` — require `TODO(spec-NNN)` tracker reference)",
            file: filePath,
            line: lineNumber,
            snippet: line.trim(),
          }));

      const LINTER_DIRECTIVE_PATTERN =
        /^(?:\/\/|\/\*)\s*((?:biome-ignore(?:-all|-start|-end)?|(?:eslint|oxlint)-(?:disable(?:-line|-next-line)?|enable)|eslint(?=\s)))\b/;

      const commentRangesOf = (content: string): readonly ts.CommentRange[] => {
        const source = parsed.tree;
        const collect = (node: ts.Node): readonly ts.CommentRange[] => [
          ...(ts.getLeadingCommentRanges(content, node.pos) ?? []),
          ...(ts.getTrailingCommentRanges(content, node.end) ?? []),
          ...node.getChildren(source).flatMap(collect),
        ];
        return [...new Map(collect(source).map((range) => [range.pos, range])).values()];
      };

      const checkBareLinterDirectiveAnnotation = (
        filePath: RepoPath,
        content: string,
      ): readonly ConstitutionViolation[] =>
        commentRangesOf(content)
          .map((range) => ({ range, comment: content.slice(range.pos, range.end) }))
          .map(({ range, comment }) => ({
            range,
            comment,
            directive: LINTER_DIRECTIVE_PATTERN.exec(comment)?.[1],
          }))
          .filter(
            ({ comment, directive }) =>
              directive !== undefined && !/\(spec-\d+\)/.test(comment),
          )
          .map(({ range, comment, directive }) => ({
            rule: `CD-5 (bare \`// ${directive}\` - require \`(spec-NNN)\` tracker reference)`,
            file: filePath,
            line: splitLines(content.slice(0, range.pos)).length,
            snippet: comment.trim(),
          }));
      const checkBareTsExpectErrorAnnotation = (
        filePath: RepoPath,
        content: string,
      ): readonly ConstitutionViolation[] =>
        splitLines(content)
          .map((line, index) => ({ line, lineNumber: index + 1 }))
          .filter(({ line }) => BARE_TS_EXPECT_ERROR_PATTERN.test(line))
          .map(({ line, lineNumber }) => ({
            rule: "CD-5 (bare `// @ts-expect-error` — require `(spec-NNN)` tracker reference)",
            file: filePath,
            line: lineNumber,
            snippet: line.trim(),
          }));

      return [
        ...checkBareTodoAnnotation(file, parsed.source),
        ...checkBareLinterDirectiveAnnotation(file, parsed.source),
        ...checkBareTsExpectErrorAnnotation(file, parsed.source),
      ].map(located);
    },
  }),
};
