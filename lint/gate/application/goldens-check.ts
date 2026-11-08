import { driftFinding, goldenDrift, type GoldenSet } from "../domain/golden.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import type { Command, CommandRunner, GoldenSource, GoldenStore } from "./ports.ts";

export type GoldensDependencies = {
  readonly runner: CommandRunner;
  readonly source: GoldenSource;
  readonly store: GoldenStore;
  readonly build: Command;
};

const buildFailure = (command: Command, output: string): Finding => ({
  subject: command.label,
  violation: `failed: ${output.trim().split(/\r?\n/).slice(-3).join(" / ")}`,
  fix: "Make the build pass first; goldens compare only a complete build.",
});

export const buildOutputs = (dependencies: GoldensDependencies): Finding | undefined => {
  const result = dependencies.runner.capture(dependencies.build);
  return result.exitCode === 0 ? undefined : buildFailure(dependencies.build, result.output);
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
    const failure = scope.build ? buildOutputs(dependencies) : undefined;
    if (failure !== undefined) {
      return judged({ id: "goldens", findings: [failure], note: "build failed" });
    }
    const expected = dependencies.store.read();
    const actual = dependencies.source.measure();
    const findings = goldenDrift({ expected, actual }).map(driftFinding);
    return judged({ id: "goldens", findings, note: `files per harness: ${groupCounts(actual)}` });
  },
});

export const updateGoldens = (dependencies: GoldensDependencies): Finding | undefined => {
  const failure = buildOutputs(dependencies);
  if (failure === undefined) {
    dependencies.store.write(dependencies.source.measure());
  }
  return failure;
};
