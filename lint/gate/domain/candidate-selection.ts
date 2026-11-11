import { CLEAN_ZONE, SCAFFOLDING_ZONE } from "../../zones.ts";
import { globMatcher } from "./glob.ts";

const BUILD_TESTS: Readonly<Record<string, readonly string[]>> = {
  "scripts/earlier-release-regions.ts": [
    "tests/unit/t-earlier-release-refresh-regions.test.ts",
    "tests/unit/t-earlier-skill-tables-refresh.test.ts",
    "tests/unit/t-skill-body-carriers.test.ts",
  ],
  "scripts/agent-knowledge.ts": [
    "tests/unit/t248-steering-content-delivery.test.ts",
    "tests/unit/t-dispatched-agents-skip-format-docs.test.ts",
  ],
  "scripts/harness-bindings.ts": ["tests/unit/t-own-harness-bindings.test.ts"],
  "scripts/onboarding.ts": [
    "tests/unit/t151-onboarding-skeleton.test.ts",
    "tests/unit/t239-documentation-parity.test.ts",
  ],
};

export const candidateBuildTests = (paths: readonly string[]): readonly string[] =>
  paths.flatMap((path) => BUILD_TESTS[path] ?? []);

const PHASE_ONE = [
  "src/**", "lint/**", "scripts/package.ts", ...Object.keys(BUILD_TESTS),
  ...CLEAN_ZONE.files, ...SCAFFOLDING_ZONE.files,
  "docs/**/*.md", "harness/**", "tests/harness/harness-matrix.ts", "tests/ratchets/**",
  "tests/{unit,smoke,integration,e2e}/**/*.test.ts",
];

const QUOTES = ['"', "'", "`"];

const builtFrom = (text: string, word: string): boolean => {
  const openings = [...QUOTES, "}/"];
  return openings.some((opening) =>
    QUOTES.some((closing) => text.includes(`${opening}${word}${closing}`)),
  );
};

const namesPath = (text: string, path: string): boolean => {
  const [top = "", ...rest] = path.split("/");
  const name = rest.at(-1) ?? "";
  const topInPath = QUOTES.some((quote) => text.includes(`${quote}${top}${quote}`));
  return text.includes(path) || (builtFrom(text, name) && (topInPath || text.includes(`${top}/`)));
};

export const testsNamingDeleted = (request: {
  readonly deleted: readonly string[];
  readonly tests: readonly string[];
  readonly textOf: (test: string) => string;
}): readonly string[] =>
  request.deleted.length === 0
    ? []
    : request.tests.filter((test) => {
        const text = request.textOf(test);
        return request.deleted.some((path) => namesPath(text, path));
      });

export const needsCandidateLegacy = (paths: readonly string[]): boolean =>
  paths.some((path) => !globMatcher(PHASE_ONE)(path));
