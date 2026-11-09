import { CLEAN_ZONE, SCAFFOLDING_ZONE } from "../../zones.ts";
import { globMatcher } from "./glob.ts";

const BUILD_TESTS: Readonly<Record<string, readonly string[]>> = {
  "scripts/earlier-release-regions.ts": [
    "tests/unit/t-earlier-release-refresh-regions.test.ts",
    "tests/unit/t-earlier-skill-tables-refresh.test.ts",
    "tests/unit/t-skill-body-carriers.test.ts",
  ],
};

export const candidateBuildTests = (paths: readonly string[]): readonly string[] =>
  paths.flatMap((path) => BUILD_TESTS[path] ?? []);

const PHASE_ONE = [
  "src/**", "lint/**", "scripts/package.ts", ...Object.keys(BUILD_TESTS),
  ...CLEAN_ZONE.files, ...SCAFFOLDING_ZONE.files,
  "docs/**/*.md", "harness/**",
  "tests/{unit,smoke,integration,e2e}/**/*.test.ts",
];

export const needsCandidateLegacy = (paths: readonly string[]): boolean =>
  paths.some((path) => !globMatcher(PHASE_ONE)(path));
