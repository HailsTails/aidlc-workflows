import { driftFinding, goldenDrift, type GoldenSet } from "../domain/golden.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { CommandRunner, GoldenSource, GoldenStore } from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";

export type GoldensDependencies = {
  readonly runner: CommandRunner;
  readonly source: GoldenSource;
  readonly store: GoldenStore;
  readonly build: SharedBuild;
};

const groupCounts = (set: GoldenSet): string =>
  Object.entries(set)
    .map(([group, manifest]) => `${group} ${Object.keys(manifest).length}`)
    .join(", ");

export const goldensCheck = (dependencies: GoldensDependencies): GateCheck => ({
  id: "goldens",
  run: async (scope) => {
    if (!scope.everything) {
      return skipped("goldens", "goldens run in --full only");
    }
    const failure = scope.build ? dependencies.build.ensure() : undefined;
    if (failure !== undefined) {
      return judged({ id: "goldens", findings: [failure], note: "build failed" });
    }
    const expected = dependencies.store.read();
    const actual = dependencies.source.measure();
    const findings = goldenDrift({ expected, actual }).map(driftFinding);
    return judged({ id: "goldens", findings, note: `files per harness: ${groupCounts(actual)}` });
  },
});

export const updateGoldens = (
  dependencies: GoldensDependencies,
  build: boolean,
): Finding | undefined => {
  const failure = build ? dependencies.build.ensure() : undefined;
  if (failure === undefined) {
    dependencies.store.write(dependencies.source.measure());
  }
  return failure;
};
