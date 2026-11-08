import type { Finding } from "./outcome.ts";

export type CategoryCounts = Readonly<Record<string, number>>;

export type CountsByFile = Readonly<Record<string, CategoryCounts>>;

export type LintMessage = {
  readonly ruleId: string | null;
  readonly message: string;
};

export type Increase = {
  readonly file: string;
  readonly category: string;
  readonly recorded: number;
  readonly measured: number;
};

export const MESSAGE_CATEGORY_RULES: readonly string[] = [
  "no-restricted-imports",
  "no-restricted-syntax",
  "no-restricted-globals",
  "no-restricted-properties",
];

const PARSE_FAILURE = "parse-error";

const CATEGORY_LABEL = /(?:^|\. )([A-Z][a-z]+(?: [a-z]+)*): /;

export const categoryOf = (lintMessage: LintMessage): string => {
  const { ruleId, message } = lintMessage;
  if (ruleId === null) {
    return PARSE_FAILURE;
  }
  const label = CATEGORY_LABEL.exec(message)?.[1];
  return MESSAGE_CATEGORY_RULES.includes(ruleId) && label !== undefined ? label : ruleId;
};

export const countCategories = (messages: readonly LintMessage[]): CategoryCounts =>
  messages.map(categoryOf).reduce<Record<string, number>>((counts, category) => {
    counts[category] = (counts[category] ?? 0) + 1;
    return counts;
  }, {});

const fileIncreases = (request: {
  readonly file: string;
  readonly recorded: CategoryCounts;
  readonly measured: CategoryCounts;
}): readonly Increase[] =>
  Object.entries(request.measured)
    .map(([category, measured]) => ({
      file: request.file,
      category,
      recorded: request.recorded[category] ?? 0,
      measured,
    }))
    .filter((entry) => entry.measured > entry.recorded);

export const increasesOver = (request: {
  readonly recorded: CountsByFile;
  readonly measured: CountsByFile;
}): readonly Increase[] =>
  Object.entries(request.measured).flatMap(([file, measured]) =>
    fileIncreases({ file, recorded: request.recorded[file] ?? {}, measured }),
  );

export const withMeasured = (request: {
  readonly recorded: CountsByFile;
  readonly measured: CountsByFile;
  readonly removed: readonly string[];
}): CountsByFile => {
  const merged: Record<string, CategoryCounts> = { ...request.recorded, ...request.measured };
  const kept = Object.entries(merged).filter(
    ([file, counts]) => !request.removed.includes(file) && Object.keys(counts).length > 0,
  );
  return Object.fromEntries(kept.sort(([left], [right]) => left.localeCompare(right)));
};

export const totalOf = (counts: CountsByFile): number =>
  Object.values(counts)
    .flatMap((categories) => Object.values(categories))
    .reduce((sum, count) => sum + count, 0);

export const increaseFinding = (increase: Increase, fix: string): Finding => ({
  subject: `${increase.file} · ${increase.category}`,
  violation: `has ${increase.measured}, over the recorded ${increase.recorded}`,
  fix,
});
