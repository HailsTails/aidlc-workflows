import { assignGroups, escapeRegex } from "./test-sharding.ts";

export type CaseTiming = {
  readonly name: string;
  readonly seconds: number;
};

export type CaseShard = {
  readonly pattern: string;
  readonly weight: number;
};

const FIRST_CHARACTER = 1;

const sharedLength = (left: string, right: string): number => {
  let length = 0;
  while (length < left.length && length < right.length && left[length] === right[length]) {
    length += 1;
  }
  return length;
};

const neighbourOverlap = (names: readonly string[], index: number): number => {
  const name = names[index] ?? "";
  const before = index > 0 ? sharedLength(name, names[index - 1] ?? "") : 0;
  const after = sharedLength(name, names[index + 1] ?? "");
  return Math.max(before, after);
};

const isPrefixOfNext = (names: readonly string[], index: number): boolean =>
  (names[index + 1] ?? "").startsWith(names[index] ?? "");

const exactly = (name: string): string => `^${escapeRegex(name)}$`;

const startingWith = (prefix: string): string => `^${escapeRegex(prefix)}`;

export const distinguishingPatterns = (
  fullNames: readonly string[],
): ReadonlyMap<string, string> => {
  const names = [...new Set(fullNames)].sort();
  return new Map(
    names.map((name, index) => {
      if (isPrefixOfNext(names, index)) {
        return [name, exactly(name)] as const;
      }
      const length = neighbourOverlap(names, index) + FIRST_CHARACTER;
      return [name, startingWith(name.slice(0, length))] as const;
    }),
  );
};

const alternation = (patterns: readonly string[]): string => `(?:${patterns.join("|")})`;

export const caseShards = (request: {
  readonly cases: readonly CaseTiming[];
  readonly targetSeconds: number;
}): readonly CaseShard[] => {
  if (request.cases.length === 0) {
    return [];
  }
  const patternOf = distinguishingPatterns(request.cases.map(({ name }) => name));
  const total = request.cases.reduce((sum, { seconds }) => sum + seconds, 0);
  const groups = Math.max(1, Math.ceil(total / request.targetSeconds));
  const items = request.cases.map(({ name, seconds }) => ({ name, weight: seconds }));
  const buckets = assignGroups(items, groups).map((members) => ({
    pattern: alternation(members.map(({ name }) => patternOf.get(name) ?? "")),
    weight: members.reduce((sum, { weight }) => sum + weight, 0),
  }));
  const catchAll = `^(?!${alternation([...patternOf.values()])})`;
  return [...buckets, { pattern: catchAll, weight: 0 }];
};

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decoded = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity] ?? entity);

const TESTCASE_TAG = /<testcase ([^>]*?)\/?>/g;

const attributeOf = (attributes: string, name: string): string | undefined => {
  const found = new RegExp(`(?:^| )${name}="([^"]*)"`).exec(attributes);
  return found === null ? undefined : decoded(found[1] ?? "");
};

const SEPARATOR = " > ";

export const casesFromJunit = (xml: string): readonly CaseTiming[] =>
  [...xml.matchAll(TESTCASE_TAG)].flatMap(([, attributes]) => {
    const name = attributeOf(attributes ?? "", "name");
    const group = attributeOf(attributes ?? "", "classname");
    const seconds = Number(attributeOf(attributes ?? "", "time"));
    if (name === undefined || !Number.isFinite(seconds)) {
      return [];
    }
    const path = group === undefined || group === "" ? [name] : [...group.split(SEPARATOR), name];
    return [{ name: path.join(" "), seconds }];
  });
