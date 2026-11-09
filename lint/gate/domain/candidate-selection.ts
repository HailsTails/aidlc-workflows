import { globMatcher } from "./glob.ts";

const PHASE_ONE = [
  "src/**", "lint/**", "scripts/gate.ts", "scripts/package.ts",
  "docs/**/*.md", "harness/**",
  "tests/{unit,smoke,integration,e2e}/**/*.test.ts",
];

export const needsCandidateLegacy = (paths: readonly string[]): boolean =>
  paths.some((path) => !globMatcher(PHASE_ONE)(path));
