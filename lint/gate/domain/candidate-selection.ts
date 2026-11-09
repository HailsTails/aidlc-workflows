import { globMatcher } from "./glob.ts";

const PHASE_ONE = ["src/**", "lint/**", "scripts/gate.ts", "scripts/package.ts"];

export const needsCandidateLegacy = (paths: readonly string[]): boolean =>
  paths.some((path) => !globMatcher(PHASE_ONE)(path));
