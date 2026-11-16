import { type ExceptionRecord, type InvalidRecord, recordImportOf } from "../exception-records/exception-records.ts";
import type { AttributedNativeException, ExemptedFinding, Finding } from "../governance/governance.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import type { ReportOutput } from "../values/report-output.ts";
import type { CheckReport, Unmeasured } from "./check-report.ts";
import { SECTION_NAMES, type SectionName } from "./section-roles.ts";
import { printedSectionLines, type ReportSection } from "./section-selection.ts";
import { verdictOf } from "./verdict.ts";

const escapedLineBreaks = (request: { readonly text: string }): string =>
  request.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r");

const findingLine = (request: { readonly finding: Finding }): string =>
  `${clauseAddressText({ address: request.finding.clause })} ${request.finding.mechanism} ${request.finding.file}:${request.finding.anchor.line}:${request.finding.anchor.column} ${escapedLineBreaks({ text: request.finding.snippet })}`;

const importNote = (request: { readonly record: ExceptionRecord }): string => {
  const recordImport = recordImportOf(request);
  return recordImport.imported === "yes" ? ` imported from ${recordImport.source}` : "";
};

const exemptedLine = (request: { readonly exempted: ExemptedFinding }): string =>
  `${findingLine({ finding: request.exempted.finding })}${request.exempted.by
    .map((record) => ` exempted by ${record.kind}${importNote({ record })}`)
    .join("")}`;

const recordFile = (request: { readonly record: ExceptionRecord }): string => {
  switch (request.record.kind) {
    case "authorised-location":
    case "file-carve-out":
      return request.record.file;
    case "clause-wide-carve-out":
      return "*";
  }
};

const recordLine = (request: { readonly record: ExceptionRecord }): string =>
  `${clauseAddressText({ address: request.record.clause })} ${request.record.mechanism} ${request.record.kind} ${recordFile(request)}`;

const unrecordedDetail = (request: { readonly exception: AttributedNativeException }): string => {
  switch (request.exception.kind) {
    case "ignore":
    case "config-override":
      return request.exception.file;
    case "suppression-entry":
      return `${request.exception.file} ${request.exception.location}`;
    case "inline-disable":
    case "inline-rule-config":
      return `${request.exception.file}:${request.exception.line} ${escapedLineBreaks({ text: request.exception.text })}`;
    case "command-line-option":
      return `${request.exception.location} ${escapedLineBreaks({ text: request.exception.script })} ${escapedLineBreaks({ text: request.exception.option })}`;
  }
};

const unrecordedLine = (request: { readonly exception: AttributedNativeException }): string =>
  `${clauseAddressText({ address: request.exception.clause })} ${request.exception.mechanism} ${request.exception.kind} ${unrecordedDetail(request)}`;

const invalidDetail = (request: { readonly problem: InvalidRecord["problem"] }): string => {
  switch (request.problem.kind) {
    case "clause-unparseable":
    case "why-chain-refused":
    case "evidence-refused":
    case "import-unverified":
      return escapedLineBreaks({ text: request.problem.detail });
    case "clause-not-selected":
    case "non-exemptible-clause":
      return clauseAddressText({ address: request.problem.clause });
    case "file-not-repo-path":
      return escapedLineBreaks({ text: request.problem.file });
    case "duplicate":
      return `of ${request.problem.ofIndex}`;
  }
};

const unmeasuredLine = (request: { readonly unmeasured: Unmeasured }): string => {
  switch (request.unmeasured.kind) {
    case "forfeiture-unmeasured":
    case "import-unmeasured":
    case "legacy-chain-unmeasured":
      return request.unmeasured.kind;
    case "mechanism-not-run":
      return `${request.unmeasured.kind} ${request.unmeasured.mechanism} ${request.unmeasured.projection}`;
  }
};

type ReportLines = (request: { readonly report: CheckReport }) => readonly string[];

const SECTION_LINES: Readonly<Record<SectionName, ReportLines>> = {
  excluded: (request) => request.report.excluded,
  findings: (request) => request.report.findings.map((finding) => findingLine({ finding })),
  exempted: (request) => request.report.exempted.map((exempted) => exemptedLine({ exempted })),
  uncovered: (request) => request.report.uncovered.map((address) => clauseAddressText({ address })),
  stale: (request) => request.report.stale.map((record) => recordLine({ record })),
  forfeited: (request) => request.report.forfeited.map((record) => recordLine({ record })),
  unrecorded: (request) => request.report.unrecorded.map((exception) => unrecordedLine({ exception })),
  doublyHeld: (request) =>
    request.report.doublyHeld.map(
      (held) => `${clauseAddressText({ address: held.clause })} ${held.mechanism} doubly-held ${held.file}`,
    ),
  invalidRecords: (request) =>
    request.report.invalidRecords.map(
      (invalid) => `exceptions[${invalid.index}] ${invalid.problem.kind} ${invalidDetail(invalid)}`,
    ),
  unmeasured: (request) => request.report.unmeasured.map((unmeasured) => unmeasuredLine({ unmeasured })),
  projectionProblems: (request) =>
    request.report.projectionProblems.map((problem) => `${problem.mechanism} ${problem.state}`),
};

const reportSections = (request: { readonly report: CheckReport }): readonly ReportSection[] =>
  SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }));

export const renderReportText = (request: { readonly report: CheckReport; readonly output: ReportOutput }): string => {
  const sectionLines = reportSections(request)
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedSectionLines({ output: request.output, section }));
  return `${[...sectionLines, `verdict: ${verdictOf(request)}`].join("\n")}\n`;
};
