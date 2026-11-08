import { distinctFixes, type CheckOutcome } from "../domain/outcome.ts";
import type { Progress } from "../application/ports.ts";
import type { GateProblem, GateReport } from "../application/run-gate.ts";
import type { DebtFigure } from "../domain/zone-rules.ts";

export const SUMMARY_PREFIX = "AIDLC_GATE";

const PRINTED_FINDINGS = 25;

const toStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

const printFindings = (outcome: CheckOutcome): void => {
  for (const finding of outcome.findings.slice(0, PRINTED_FINDINGS)) {
    toStderr(`    - ${finding.subject}: ${finding.violation}`);
  }
  const hidden = outcome.findings.length - PRINTED_FINDINGS;
  if (hidden > 0) {
    toStderr(`    - and ${hidden} more`);
  }
  for (const fix of distinctFixes(outcome.findings)) {
    toStderr(`    fix: ${fix}`);
  }
};

export const consoleProgress: Progress = {
  started: (id) => toStderr(`gate · ${id} …`),
  finished: (outcome) => {
    const count = outcome.findings.length;
    toStderr(`gate · ${outcome.id} · ${outcome.status} · ${count} findings · ${outcome.note}`);
    printFindings(outcome);
  },
  note: toStderr,
};

export type ReportedRun = {
  readonly report: GateReport;
  readonly debt: DebtFigure | undefined;
};

export const printDebt = (debt: DebtFigure | undefined): void => {
  if (debt !== undefined) {
    toStderr(
      `gate · debt · ${debt.findings} recorded findings remain in ${debt.files} debt-zone ` +
        "files; the clean zone is judged apart from them",
    );
  }
};

export const summaryLine = ({ report, debt }: ReportedRun): string => {
  const checks = report.outcomes.map((outcome) => ({
    id: outcome.id,
    result: outcome.status,
    violations: outcome.findings.length,
    fix: distinctFixes(outcome.findings),
  }));
  const summary = {
    schema: 1,
    mode: report.mode,
    lane: report.lane ?? null,
    base: report.base ?? null,
    result: report.verdict,
    checks,
    ...(debt === undefined ? {} : { debt }),
    ...(report.problem === undefined ? {} : { problem: report.problem }),
    ...(report.exitCode === undefined ? {} : { exitCode: report.exitCode }),
  };
  return `${SUMMARY_PREFIX} ${JSON.stringify(summary)}`;
};

export const usageSummaryLine = (problem: GateProblem): string => {
  const summary = { schema: 1, mode: "usage", lane: null, base: null, result: "error", checks: [] };
  return `${SUMMARY_PREFIX} ${JSON.stringify({ ...summary, problem })}`;
};

export const printProblem = (report: GateReport): void => {
  if (report.problem !== undefined) {
    toStderr(`gate · ${report.verdict}: ${report.problem.problem}`);
    toStderr(`    fix: ${report.problem.fix}`);
  }
};
