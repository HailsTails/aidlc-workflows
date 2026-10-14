import type { CheckReport } from "./check-report.ts";

export type Verdict = "pass" | "fail";

export const verdictOf = (request: { readonly report: CheckReport }): Verdict =>
  [
    request.report.findings,
    request.report.uncovered,
    request.report.stale,
    request.report.forfeited,
    request.report.unrecorded,
    request.report.doublyHeld,
    request.report.invalidRecords,
    request.report.unmeasured,
    request.report.projectionProblems,
  ].every((list) => list.length === 0)
    ? "pass"
    : "fail";
