import { moduleKindOf, zoneOf } from "../../zones.ts";
import type { ChangedFile } from "./change.ts";
import type { Finding } from "./outcome.ts";
import type { CountsByFile } from "./violation-ratchet.ts";

export const AUTHORISED_LOCATION = "authorised-location";

export type DisciplineException = {
  readonly kind: string;
  readonly clause: string;
  readonly file: string | undefined;
};

export const newDebtModules = (changes: readonly ChangedFile[]): readonly Finding[] =>
  changes
    .filter(
      (change) =>
        change.kind === "added" &&
        moduleKindOf(change.path) === "typescript" &&
        zoneOf(change.path) === "debt",
    )
    .map((change) => ({
      subject: change.path,
      violation: "is a new TypeScript module in the debt zone, which only shrinks",
      fix:
        "Create the module in its context under src/ and repoint callers there; the debt " +
        "zone takes only edits that move callers and data files such as goldens. A file that " +
        "comes from the upstream project is admitted once git fetch upstream has run.",
    }));

export const hiddenBaselineEntries = (baseline: CountsByFile): readonly Finding[] =>
  Object.keys(baseline)
    .filter((file) => zoneOf(file) !== "debt")
    .map((file) => ({
      subject: `boundary baseline · ${file}`,
      violation: `records findings for a ${zoneOf(file)}-zone file, where the baseline is zero`,
      fix: "Delete the entry and fix the findings in the file; only the debt zone has a baseline.",
    }));

export const debtOnly = (counts: CountsByFile): CountsByFile =>
  Object.fromEntries(Object.entries(counts).filter(([file]) => zoneOf(file) === "debt"));

export const staleExcludes = (request: {
  readonly recorded: readonly string[] | undefined;
  readonly generated: readonly string[];
}): readonly Finding[] => {
  const recorded = request.recorded ?? [];
  const missing = request.generated.filter((entry) => !recorded.includes(entry));
  const extra = recorded.filter((entry) => !request.generated.includes(entry));
  return missing.length === 0 && extra.length === 0 && request.recorded !== undefined
    ? []
    : [
        {
          subject: "disciplines.json · exclude",
          violation:
            `differs from the zones in lint/zones.ts (missing ${missing.length}, ` +
            `extra ${extra.length})`,
          fix:
            "Regenerate it with bun scripts/gate.ts --scope G --only zones --record; the " +
            "exclude list is written from lint/zones.ts, never by hand.",
        },
      ];
};

export const carveOuts = (exceptions: readonly DisciplineException[]): readonly Finding[] =>
  exceptions
    .filter((exception) => exception.kind !== AUTHORISED_LOCATION)
    .map((exception) => ({
      subject: `discipline-exceptions.json · ${exception.clause} · ${exception.file ?? "*"}`,
      violation: `is a ${exception.kind}, and the clean zone takes no carve-outs`,
      fix:
        "Fix the finding in the code. Only an authorised-location, the one file that wraps " +
        "a capability, may be recorded on a clean path.",
    }));

export type DebtFigure = {
  readonly findings: number;
  readonly files: number;
};

export const debtFigureOf = (baseline: CountsByFile): DebtFigure => {
  const debt = Object.values(debtOnly(baseline));
  const findings = debt.flatMap(Object.values).reduce((sum, count) => sum + count, 0);
  return { findings, files: debt.length };
};
