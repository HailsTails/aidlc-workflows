import type { CheckReport } from "./check-report.ts";

export type Verdict = "pass" | "fail";

export type SectionRole = "failing" | "informational";

const FAILING_SECTIONS = [
  "findings",
  "uncovered",
  "stale",
  "forfeited",
  "unrecorded",
  "doublyHeld",
  "invalidRecords",
  "unmeasured",
  "projectionProblems",
] as const satisfies readonly (keyof CheckReport)[];

export const sectionRoleOf = (request: { readonly section: keyof CheckReport }): SectionRole =>
  FAILING_SECTIONS.some((failing) => failing === request.section) ? "failing" : "informational";

export const verdictOf = (request: { readonly report: CheckReport }): Verdict =>
  FAILING_SECTIONS.every((section) => request.report[section].length === 0) ? "pass" : "fail";
