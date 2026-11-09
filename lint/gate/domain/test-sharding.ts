export type Shard = {
  readonly pattern: string | undefined;
  readonly weight: number;
};

export type PlanItem = {
  readonly files: readonly string[];
  readonly pattern: string | undefined;
  readonly weight: number;
};

const REGEX_SPECIALS = ".*+?^${}()|[]\\";
const ESCAPE = String.fromCharCode(92);

export const escapeRegex = (text: string): string =>
  Array.from(text, (character) =>
    REGEX_SPECIALS.includes(character) ? ESCAPE + character : character,
  ).join("");

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

export const assignGroups = <T extends { readonly weight: number }>(
  items: readonly T[],
  groups: number,
): readonly (readonly T[])[] => {
  const buckets = Array.from({ length: Math.max(1, groups) }, () => ({
    total: 0,
    members: [] as T[],
  }));
  for (const item of [...items].sort((a, b) => b.weight - a.weight)) {
    const lightest = buckets.reduce((best, next) => (next.total < best.total ? next : best));
    lightest.members.push(item);
    lightest.total += item.weight;
  }
  return buckets.filter((bucket) => bucket.members.length > 0).map((bucket) => bucket.members);
};

export type PlanRequest = {
  readonly files: readonly string[];
  readonly weightOf: (file: string) => number;
  readonly describesOf: (file: string) => readonly string[];
  readonly hasOtherTests: (file: string) => boolean;
  readonly splitAtOrAbove: number;
  readonly groups: number;
};

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
  const big = request.files.filter((file) => request.weightOf(file) >= request.splitAtOrAbove);
  const small = request.files.filter((file) => !big.includes(file));
  const packed = assignGroups(
    small.map((file) => ({ file, weight: request.weightOf(file) })),
    request.groups,
  ).map((group) => ({
    files: group.map(({ file }) => file),
    pattern: undefined,
    weight: group.reduce((sum, { weight }) => sum + weight, 0),
  }));
  return [...big.flatMap((file) => shardsOf(request, file)), ...packed].sort(
    (a, b) => b.weight - a.weight,
  );
};
