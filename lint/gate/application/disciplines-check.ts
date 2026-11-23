import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches } from "./gate-scope.ts";
import type { AuditFinding, AuditReport, DisciplineAudit } from "./ports.ts";

export type DisciplinesDependencies = {
  readonly audit: DisciplineAudit;
  readonly triggers: readonly string[];
  readonly fallbackBase: string;
};

const RULE_PAGE = "node_modules/@hailstails/hone/rules";

const findingOf = (finding: AuditFinding): Finding => ({
  subject: finding.location,
  violation: `breaks ${finding.clause}: ${finding.snippet}`,
  fix:
    `Fix the code to the rule; ${RULE_PAGE} says how. Only the one file ` +
    "that wraps a capability may be recorded, as an authorised-location.",
});

const problemOf = (line: string): Finding => ({
  subject: "hone",
  violation: line,
  fix: "Correct hone.config.json or hone-records; the report line names the entry.",
});

const UNEXPLAINED_FAIL = "gave verdict fail without listing why";

const findingsOf = (report: AuditReport): readonly Finding[] => {
  if (report.kind === "failed") {
    return [{ subject: "hone", violation: report.problem, fix: report.fix }];
  }
  const listed = [...report.findings.map(findingOf), ...report.problems.map(problemOf)];
  return report.verdict === "fail" && listed.length === 0 ? [problemOf(UNEXPLAINED_FAIL)] : listed;
};

const projectionFindings = (audit: DisciplineAudit): readonly Finding[] => {
  const projected = audit.project();
  return projected.ok
    ? []
    : [{ subject: "hone.eslint.mjs", violation: projected.problem, fix: projected.fix }];
};

export const disciplinesCheck = (dependencies: DisciplinesDependencies): GateCheck => ({
  id: "disciplines",
  run: async (scope) => {
    if (!scope.everything && !touches(scope, dependencies.triggers)) {
      return skipped("disciplines", "no clean-zone file changed");
    }
    const projection = scope.record ? projectionFindings(dependencies.audit) : [];
    const report = dependencies.audit.run(scope.base?.ref ?? dependencies.fallbackBase);
    const findings = [...projection, ...findingsOf(report)];
    const verdict = report.kind === "ran" ? `verdict ${report.verdict}` : "did not run";
    const note = `hone on the clean zone: ${verdict}`;
    return judged({ id: "disciplines", findings, note });
  },
});
