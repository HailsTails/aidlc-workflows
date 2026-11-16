import type { ReportOutput } from "../values/report-output.ts";
import { type SectionName, sectionRoleOf } from "./section-roles.ts";

export type ReportSection = {
  readonly name: SectionName;
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

const countLine = (request: { readonly section: ReportSection }): string =>
  sectionRoleOf({ section: request.section.name }) === "failing" ? heading(request) : `${heading(request)} informational`;

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
      return [countLine(request)];
    case "verdict-only":
      return [];
  }
};
