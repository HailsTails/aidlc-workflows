import { caseShards, type CaseTiming } from "./case-split.ts";
import { assignGroups, escapeRegex } from "./grouping.ts";

export { assignGroups, escapeRegex };

export type Shard = {
  readonly pattern: string | undefined;
  readonly weight: number;
};

export type PlanItem = {
  readonly files: readonly string[];
  readonly pattern: string | undefined;
  readonly weight: number;
  readonly canBeEmpty?: boolean;
};

const startsWithName = (name: string): string => `${escapeRegex(name)}( |$)`;

const longerNamesOf = (name: string, names: readonly string[]): readonly string[] =>
  names.filter((other) => other.startsWith(`${name} `));

const ownedBy = (name: string, names: readonly string[]): string => {
  const longer = longerNamesOf(name, names);
  const exclusion = longer.length === 0 ? "" : `(?!${longer.map(startsWithName).join("|")})`;
  return `^${exclusion}${startsWithName(name)}`;
};

export const describePatterns = (
  describes: readonly string[],
  withRemainder = true,
): readonly string[] => {
  const names = [...new Set(describes)];
  const remainder = `^(?!(?:${names.map(startsWithName).join("|")}))`;
  const owned = names.map((name) => ownedBy(name, names));
  return names.length === 0 ? [] : [...owned, ...(withRemainder ? [remainder] : [])];
};

export type PlanRequest = {
  readonly files: readonly string[];
  readonly weightOf: (file: string) => number;
  readonly describesOf: (file: string) => readonly string[];
  readonly hasOtherTests: (file: string) => boolean;
  readonly splitAtOrAbove: number;
  readonly groups: number;
  readonly casesOf: (file: string) => readonly CaseTiming[];
  readonly targetSeconds: number;
};

const MAX_PATTERN_LENGTH = 16_000;

const recordedSeconds = (cases: readonly CaseTiming[]): number =>
  cases.reduce((sum, { seconds }) => sum + seconds, 0);

const caseItemsOf = (request: PlanRequest, file: string): readonly PlanItem[] => {
  const cases = request.casesOf(file);
  const shards = caseShards({ cases, targetSeconds: request.targetSeconds });
  const fits = shards.every(({ pattern }) => pattern.length <= MAX_PATTERN_LENGTH);
  const lastIndex = shards.length - 1;
  return fits
    ? shards.map(({ pattern, weight }, index) => ({
        files: [file],
        pattern,
        weight: Math.max(weight, 1),
        canBeEmpty: index === lastIndex,
      }))
    : [];
};

const isCaseSplit = (request: PlanRequest, file: string): boolean =>
  recordedSeconds(request.casesOf(file)) > request.targetSeconds &&
  caseItemsOf(request, file).length > 0;

const shardsOf = (request: PlanRequest, file: string): readonly PlanItem[] => {
  const patterns = describePatterns(request.describesOf(file), request.hasOtherTests(file));
  const weight = request.weightOf(file);
  return patterns.length === 0
    ? [{ files: [file], pattern: undefined, weight }]
    : patterns.map((pattern) => ({
        files: [file],
        pattern,
        weight: weight / patterns.length,
      }));
};

export const planItems = (request: PlanRequest): readonly PlanItem[] => {
  const byCase = request.files.filter((file) => isCaseSplit(request, file));
  const rest = request.files.filter((file) => !byCase.includes(file));
  const big = rest.filter((file) => request.weightOf(file) >= request.splitAtOrAbove);
  const small = rest.filter((file) => !big.includes(file));
  const packed = assignGroups(
    small.map((file) => ({ file, weight: request.weightOf(file) })),
    request.groups,
  ).map((group) => ({
    files: group.map(({ file }) => file),
    pattern: undefined,
    weight: group.reduce((sum, { weight }) => sum + weight, 0),
  }));
  const caseItems = byCase.flatMap((file) => caseItemsOf(request, file));
  return [...caseItems, ...big.flatMap((file) => shardsOf(request, file)), ...packed].sort(
    (a, b) => b.weight - a.weight,
  );
};
