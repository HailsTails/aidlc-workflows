import { isLaneAuthored, type Arrivals } from "../domain/arrival.ts";
import type { BaseRevision } from "../domain/change.ts";
import { judgeMonolith } from "../domain/monolith.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import { increasesOver } from "../domain/violation-ratchet.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { RatchetRecords, Repository } from "./ports.ts";

export type RecordsDependencies = {
  readonly repository: Repository;
  readonly records: RatchetRecords;
  readonly ruleInputs: readonly string[];
};

const RECORDS_ONLY_FALL =
  "Records only go down. Restore the recorded number and fix the code instead; a rule " +
  "change that moves the baseline belongs to Lane G with the rule itself.";

type Rises = {
  readonly records: RatchetRecords;
  readonly base: BaseRevision;
  readonly arrivals: Arrivals;
};

const boundaryRises = ({ records, base, arrivals }: Rises): readonly Finding[] => {
  const recorded = records.boundary({ kind: "base", commit: base.commit });
  const measured = records.boundary({ kind: "head" });
  if (recorded === undefined || measured === undefined) {
    return [];
  }
  const laneAuthored = isLaneAuthored(arrivals);
  const increases = increasesOver({ recorded, measured });
  return increases.filter((increase) => laneAuthored(increase.file)).map((increase) => ({
    subject: `boundary baseline · ${increase.file} · ${increase.category}`,
    violation: `was raised from ${increase.recorded} to ${increase.measured}`,
    fix: RECORDS_ONLY_FALL,
  }));
};

const monolithRises = ({ records, base, arrivals }: Rises): readonly Finding[] =>
  records.monolithFiles.filter(isLaneAuthored(arrivals)).flatMap((file) => {
    const recorded = records.monolith({ source: { kind: "base", commit: base.commit }, file });
    const measured = records.monolith({ source: { kind: "head" }, file });
    return recorded === undefined || measured === undefined
      ? []
      : judgeMonolith({ recorded, measured }).map((finding) => ({
          ...finding,
          subject: `monolith record · ${finding.subject}`,
          fix: RECORDS_ONLY_FALL,
        }));
  });

const rulesNote = (scope: GateScope, ruleInputs: readonly string[]): string =>
  touches(scope, ruleInputs)
    ? "lint rules changed in this diff, so the boundary baseline may move with them"
    : "boundary baseline and monolith records at or under the base";

export const recordsCheck = (dependencies: RecordsDependencies): GateCheck => ({
  id: "records",
  run: async (scope) => {
    const { base } = scope;
    if (base === undefined) {
      return skipped("records", "no base revision in --scope <paths> mode");
    }
    const { records, ruleInputs } = dependencies;
    const rulesChanged = touches(scope, ruleInputs);
    const arrivals = dependencies.repository.arrivals(base);
    const rises = { records, base, arrivals };
    const boundary = rulesChanged ? [] : boundaryRises(rises);
    const findings = [...boundary, ...monolithRises(rises)];
    return judged({ id: "records", findings, note: rulesNote(scope, ruleInputs) });
  },
});
