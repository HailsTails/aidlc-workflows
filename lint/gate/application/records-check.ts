import type { BaseRevision } from "../domain/change.ts";
import { judgeMonolith } from "../domain/monolith.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import { increasesOver } from "../domain/violation-ratchet.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { RatchetRecords } from "./ports.ts";

export type RecordsDependencies = {
  readonly records: RatchetRecords;
  readonly ruleInputs: readonly string[];
};

const RECORDS_ONLY_FALL =
  "Records only go down. Restore the recorded number and fix the code instead; a rule " +
  "change that moves the baseline belongs to Lane G with the rule itself.";

const boundaryRises = (records: RatchetRecords, base: BaseRevision): readonly Finding[] => {
  const recorded = records.boundary({ kind: "base", commit: base.commit });
  const measured = records.boundary({ kind: "head" });
  if (recorded === undefined || measured === undefined) {
    return [];
  }
  return increasesOver({ recorded, measured }).map((increase) => ({
    subject: `boundary baseline · ${increase.file} · ${increase.category}`,
    violation: `was raised from ${increase.recorded} to ${increase.measured}`,
    fix: RECORDS_ONLY_FALL,
  }));
};

const monolithRises = (records: RatchetRecords, base: BaseRevision): readonly Finding[] =>
  records.monolithFiles.flatMap((file) => {
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
    const boundary = rulesChanged ? [] : boundaryRises(records, base);
    const findings = [...boundary, ...monolithRises(records, base)];
    return judged({ id: "records", findings, note: rulesNote(scope, ruleInputs) });
  },
});
