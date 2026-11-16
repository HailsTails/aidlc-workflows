import type { CheckReport } from "./check-report.ts";
import { sectionsWithRole } from "./section-roles.ts";

export type Verdict = "pass" | "fail";

const FAILING_SECTIONS = sectionsWithRole({ role: "failing" });

export const verdictOf = (request: { readonly report: CheckReport }): Verdict =>
  FAILING_SECTIONS.every((section) => request.report[section].length === 0) ? "pass" : "fail";
