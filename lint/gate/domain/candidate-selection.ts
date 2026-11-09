import { CLEAN_ZONE, SCAFFOLDING_ZONE } from "../../zones.ts";
import { globMatcher } from "./glob.ts";

const PHASE_ONE = [
  "src/**", "lint/**", "scripts/package.ts",
  ...CLEAN_ZONE.files, ...SCAFFOLDING_ZONE.files,
  "docs/**/*.md", "harness/**",
  "tests/{unit,smoke,integration,e2e}/**/*.test.ts",
];

export const needsCandidateLegacy = (paths: readonly string[]): boolean =>
  paths.some((path) => !globMatcher(PHASE_ONE)(path));
