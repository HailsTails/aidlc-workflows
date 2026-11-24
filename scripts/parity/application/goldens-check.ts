import { driftFinding, goldenDrift, type GoldenSet } from "../domain/golden.ts";
import type { Finding } from "../domain/outcome.ts";
import type { GoldenSource, GoldenStore } from "./ports.ts";

export type GoldensDependencies = {
  readonly source: GoldenSource;
  readonly store: GoldenStore;
};

export type GoldensReport = {
  readonly findings: readonly Finding[];
  readonly note: string;
};

const groupCounts = (set: GoldenSet): string =>
  Object.entries(set)
    .map(([group, manifest]) => `${group} ${Object.keys(manifest).length}`)
    .join(", ");

export const goldensCheck = (dependencies: GoldensDependencies): GoldensReport => {
  const expected = dependencies.store.read();
  const hasBaselineFiles = Object.values(expected).some((manifest) => Object.keys(manifest).length > 0);
  if (!hasBaselineFiles) {
    return {
      findings: [{
        subject: "baseline goldens",
        violation: "no baseline files are recorded",
        fix: "Supply non-empty goldens recorded from the independent pinned baseline before checking candidate output.",
      }],
      note: "baseline unavailable",
    };
  }
  const actual = dependencies.source.measure();
  const findings = goldenDrift({ expected, actual }).map(driftFinding);
  return { findings, note: `files per harness: ${groupCounts(actual)}` };
};

export const updateGoldens = (dependencies: GoldensDependencies): void => {
  dependencies.store.write(dependencies.source.measure());
};
