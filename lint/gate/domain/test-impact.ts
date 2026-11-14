import { globMatcher } from "./glob.ts";

export type TestReach = Readonly<Record<string, readonly string[]>>;

export const EVERY_TEST_MOVES_WITH: readonly string[] = [
  "tests/golden/**",
  "tests/harness/**",
  "tests/fixtures/**",
  "tests/run-tests.ts",
  "tests/unit-shard-weights.json",
  "tests/lib/**",
  "package.json",
  "bun.lock",
  "tsconfig*.json",
  "bunfig.toml",
  "scripts/package.ts",
];

export type ImpactRequest = {
  readonly tests: readonly string[];
  readonly reach: TestReach;
  readonly changed: readonly string[];
  readonly moveEverything?: readonly string[];
};

const reachedBy = (reach: readonly string[], changed: readonly string[]): boolean => {
  const matches = globMatcher(reach);
  return changed.some((path) => matches(path));
};

export const impactedTests = (request: ImpactRequest): readonly string[] => {
  const { tests, reach, changed } = request;
  const forcing = globMatcher(request.moveEverything ?? EVERY_TEST_MOVES_WITH);
  if (changed.some((path) => forcing(path))) {
    return tests;
  }
  const known = globMatcher([...tests, ...tests.flatMap((test) => reach[test] ?? [])]);
  if (changed.some((path) => !known(path))) {
    return tests;
  }
  return tests.filter(
    (test) =>
      reach[test] === undefined || changed.includes(test) || reachedBy(reach[test], changed),
  );
};
