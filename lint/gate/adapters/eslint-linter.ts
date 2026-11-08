import { relative } from "node:path";
import { ESLint } from "eslint";
import { categoryOf, countCategories, type CountsByFile } from "../domain/violation-ratchet.ts";
import type { Linter, LintExamples, LintMeasurement, LintTargets } from "../application/ports.ts";

export type EslintScope = {
  readonly root: string;
  readonly roots: readonly string[];
  readonly extensions: readonly string[];
};

const relativeTo = (root: string, file: string): string =>
  relative(root, file).replaceAll("\\", "/");

const firstMessages = (result: ESLint.LintResult): Readonly<Record<string, string>> => {
  const examples: Record<string, string> = {};
  for (const message of result.messages) {
    examples[categoryOf(message)] ??= message.message;
  }
  return examples;
};

const measured = (root: string, results: readonly ESLint.LintResult[]): LintMeasurement => {
  const counts: Record<string, CountsByFile[string]> = {};
  const examples: Record<string, LintExamples[string]> = {};
  for (const result of results) {
    const file = relativeTo(root, result.filePath);
    counts[file] = countCategories(result.messages);
    examples[file] = firstMessages(result);
  }
  return { counts, examples };
};

const lintable = async (request: {
  readonly eslint: ESLint;
  readonly scope: EslintScope;
  readonly files: readonly string[];
}): Promise<readonly string[]> => {
  const { eslint, scope, files } = request;
  const candidates = files.filter((file) => scope.extensions.some((ext) => file.endsWith(ext)));
  const ignored = await Promise.all(candidates.map((file) => eslint.isPathIgnored(file)));
  return candidates.filter((_, index) => ignored[index] === false);
};

export const eslintLinter = (scope: EslintScope): Linter => ({
  measure: async (targets: LintTargets) => {
    const eslint = new ESLint({ cwd: scope.root, errorOnUnmatchedPattern: false });
    const files =
      targets.kind === "all"
        ? [...scope.roots]
        : await lintable({ eslint, scope, files: targets.files });
    const results = files.length === 0 ? [] : await eslint.lintFiles([...files]);
    return measured(scope.root, results);
  },
});
