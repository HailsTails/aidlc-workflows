import { presentPaths } from "../domain/change.ts";
import { fixFor } from "../domain/fix-catalog.ts";
import { judged, skipped } from "../domain/outcome.ts";
import {
  increaseFinding,
  increasesOver,
  totalOf,
  withMeasured,
  type CountsByFile,
} from "../domain/violation-ratchet.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { Linter, LintMeasurement, LintTargets, RatchetRecords } from "./ports.ts";

export type LintDependencies = {
  readonly linter: Linter;
  readonly records: RatchetRecords;
  readonly ruleInputs: readonly string[];
};

const targetsOf = (scope: GateScope): LintTargets =>
  scope.everything ? { kind: "all" } : { kind: "files", files: presentPaths(scope.changes) };

const RULES_CHANGED =
  "; lint rules changed, so only --full re-measures every file against the baseline";

const removedFiles = (request: {
  readonly scope: GateScope;
  readonly targets: LintTargets;
  readonly recorded: CountsByFile;
  readonly measured: CountsByFile;
}): readonly string[] =>
  request.targets.kind === "all"
    ? Object.keys(request.recorded).filter((file) => request.measured[file] === undefined)
    : request.scope.changes.filter((change) => change.kind === "deleted").map((c) => c.path);

const record = (request: {
  readonly scope: GateScope;
  readonly targets: LintTargets;
  readonly recorded: CountsByFile;
  readonly measurement: LintMeasurement;
  readonly records: RatchetRecords;
}): void => {
  const measured = request.measurement.counts;
  const removed = removedFiles({ ...request, measured });
  request.records.saveBoundary(withMeasured({ recorded: request.recorded, measured, removed }));
};

const noteFor = (recorded: CountsByFile, measurement: LintMeasurement): string => {
  const files = Object.keys(measurement.counts).length;
  return `${files} files linted; ${totalOf(measurement.counts)} recorded-kind findings in them; ` +
    `baseline total ${totalOf(recorded)}`;
};

export const lintCheck = (dependencies: LintDependencies): GateCheck => ({
  id: "lint",
  run: async (scope) => {
    const targets = targetsOf(scope);
    if (targets.kind === "files" && targets.files.length === 0) {
      return skipped("lint", "no changed files to lint");
    }
    const measurement = await dependencies.linter.measure(targets);
    const recorded = dependencies.records.boundary({ kind: "head" }) ?? {};
    const findings = increasesOver({ recorded, measured: measurement.counts }).map((increase) => {
      const example = measurement.examples[increase.file]?.[increase.category] ?? "";
      return increaseFinding(increase, fixFor({ category: increase.category, example }));
    });
    if (scope.record) {
      record({ scope, targets, recorded, measurement, records: dependencies.records });
    }
    const partial = !scope.everything && touches(scope, dependencies.ruleInputs);
    const note = `${noteFor(recorded, measurement)}${partial ? RULES_CHANGED : ""}`;
    return judged({ id: "lint", findings, note });
  },
});
