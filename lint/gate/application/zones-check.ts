import { auditExcludes } from "../../zones.ts";
import { isLaneAuthored, NO_ARRIVALS } from "../domain/arrival.ts";
import { judged, type Finding } from "../domain/outcome.ts";
import {
  carveOuts,
  hiddenBaselineEntries,
  newDebtModules,
  staleExcludes,
} from "../domain/zone-rules.ts";
import type { GateCheck } from "./gate-check.ts";
import type { DisciplineSelection, RatchetRecords, Repository } from "./ports.ts";

export type ZonesDependencies = {
  readonly repository: Repository;
  readonly selection: DisciplineSelection;
  readonly records: RatchetRecords;
};

const exceptionFindings = (selection: DisciplineSelection): readonly Finding[] => {
  const exceptions = selection.exceptions();
  if (exceptions.ok) {
    return carveOuts(exceptions.value);
  }
  const { problem, fix } = exceptions;
  return [{ subject: "discipline-exceptions.json", violation: problem, fix }];
};

export const zonesCheck = (dependencies: ZonesDependencies): GateCheck => ({
  id: "zones",
  run: async (scope) => {
    const { repository, selection, records } = dependencies;
    const arrivals = scope.base === undefined ? NO_ARRIVALS : repository.arrivals(scope.base);
    const generated = auditExcludes(repository.listFiles());
    if (scope.record) {
      selection.saveExcludes(generated);
    }
    const findings = [
      ...newDebtModules(scope.changes.filter((change) => isLaneAuthored(arrivals)(change.path))),
      ...hiddenBaselineEntries(records.boundary({ kind: "head" }) ?? {}),
      ...staleExcludes({ recorded: selection.excludes(), generated }),
      ...exceptionFindings(selection),
    ];
    const note = `${generated.length} audit excludes generated from lint/zones.ts`;
    return judged({ id: "zones", findings, note });
  },
});
