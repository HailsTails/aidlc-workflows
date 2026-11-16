import type { ReportOutput } from "../values/report-output.ts";
import type { CheckReport } from "./check-report.ts";
import { sectionRoleOf } from "./verdict.ts";

export type ReportSection = {
  readonly name: keyof CheckReport;
  readonly lines: readonly string[];
};

const heading = (request: { readonly section: ReportSection }): string =>
  `${request.section.name} (${request.section.lines.length})`;

const headedEntries = (request: { readonly section: ReportSection }): readonly string[] => [
  heading(request),
  ...request.section.lines,
];

const failingEntries = (request: { readonly section: ReportSection }): readonly string[] =>
  sectionRoleOf({ section: request.section.name }) === "failing" ? headedEntries(request) : [];

export const printedSectionLines = (request: {
  readonly output: ReportOutput;
  readonly section: ReportSection;
}): readonly string[] => {
  switch (request.output) {
    case "full":
      return headedEntries(request);
    case "failures-only":
      return failingEntries(request);
    case "counts":
      return [heading(request)];
    case "verdict-only":
      return [];
  }
};
