import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { WhyChain } from "../values/why-chain.ts";
import type { CheckReport } from "./check-report.ts";
import { renderReportText } from "./report-text.ts";

const noClass = clauseAddressSchema.parse("CD-14#no-class-syntax");
const probeNoTmp = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const fileA = repoPathSchema.parse("src/a.ts");
const packageJson = repoPathSchema.parse("package.json");
const suppressions = repoPathSchema.parse("eslint-suppressions.json");
const audit = mechanismIdSchema.parse("audit");
const eslint = mechanismIdSchema.parse("eslint");

const why = {
  why: "Why does this file declare a class?",
  because: "The vendored parser exports a class the adapter must extend",
  evidence: "vendor/parser/index.d.ts line 12",
};

const whyChain: WhyChain = {
  whys: [why, why, why, why, why],
  rootCause: "The vendored parser's extension point is class-based",
  owner: "260926-vendor-divergence-untrac",
};

const finding: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const located: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation" },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
};

const carved: ExceptionRecord = {
  kind: "file-carve-out",
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the parser adapter is unpaid debt",
  whyChain,
};

const carvedEverywhere: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: noClass,
  mechanism: audit,
  reason: "the whole clause is unpaid debt",
  whyChain,
};

const emptyReport: CheckReport = {
  excluded: [],
  findings: [],
  exempted: [],
  uncovered: [],
  stale: [],
  forfeited: [],
  unrecorded: [],
  doublyHeld: [],
  invalidRecords: [],
  unmeasured: [],
  projectionProblems: [],
};

describe("renderReportText entry lines", () => {
  it("renders a finding as clause, mechanism, file:line:column and snippet", () => {
    expect(
      renderReportText({ report: { ...emptyReport, findings: [finding] } }),
    ).toContain("\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\n");
  });

  it("renders the excluded paths first, one per line, before any finding", () => {
    expect(
      renderReportText({
        report: { ...emptyReport, excluded: [repoPathSchema.parse("generated"), repoPathSchema.parse("src/legacy.ts")], findings: [finding] },
      }),
    ).toBe(
      "excluded (2)\ngenerated\nsrc/legacy.ts\nfindings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nverdict: fail\n",
    );
  });

  it("renders an exempted finding followed by the kind of each crediting record", () => {
    expect(
      renderReportText({
        report: { ...emptyReport, exempted: [{ finding, by: [carved, carvedEverywhere] }] },
      }),
    ).toContain(
      "\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by file-carve-out exempted by clause-wide-carve-out\n",
    );
  });

  it("renders an uncovered clause as its address text", () => {
    expect(
      renderReportText({ report: { ...emptyReport, uncovered: [probeNoTmp] } }),
    ).toContain("\nprobe/PD-1#no-tmp-files\n");
  });

  it("renders a stale authorised location as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ report: { ...emptyReport, stale: [located] } }),
    ).toContain("\nCD-14#no-class-syntax audit authorised-location src/a.ts\n");
  });

  it("renders a stale clause-wide carve-out with * for its file", () => {
    expect(
      renderReportText({ report: { ...emptyReport, stale: [carvedEverywhere] } }),
    ).toContain("\nCD-14#no-class-syntax audit clause-wide-carve-out *\n");
  });

  it("renders a forfeited file carve-out as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({ report: { ...emptyReport, forfeited: [carved] } }),
    ).toContain("\nCD-14#no-class-syntax audit file-carve-out src/a.ts\n");
  });

  it("renders a doubly-held entry as clause, mechanism, doubly-held and file", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax audit doubly-held src/a.ts\n");
  });

  it("renders an unrecorded ignore as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint ignore src/a.ts\n");
  });

  it("renders an unrecorded config override as clause, mechanism, kind and file", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            { kind: "config-override", clause: noClass, file: fileA, mechanism: eslint },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint config-override src/a.ts\n");
  });

  it("renders an unrecorded suppression entry with its location", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "suppression-entry",
              clause: noClass,
              file: fileA,
              location: suppressions,
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint suppression-entry src/a.ts eslint-suppressions.json\n");
  });

  it("renders a finding whose snippet holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          findings: [{ ...finding, snippet: "class A {\n}\r\nclass B {}" }],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax audit src/a.ts:3:5 class A {\n}\r\nclass B {}
`);
  });

  it("renders an unrecorded inline disable whose text holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "/* eslint-disable\nno-class */\r",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint inline-disable src/a.ts:7 /* eslint-disable\nno-class */\r
`);
  });

  it("renders a command-line option whose script and option hold line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint\r\nfix",
              option: "--rule\nno-class:off",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain(String.raw`
CD-14#no-class-syntax eslint command-line-option package.json lint\r\nfix --rule\nno-class:off
`);
  });

  it("renders an invalid record whose detail holds line breaks on one line with each break escaped", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 4,
              problem: { kind: "why-chain-refused", detail: "why 2\nis empty\r" },
            },
          ],
        },
      }),
    ).toContain(String.raw`
exceptions[4] why-chain-refused why 2\nis empty\r
`);
  });

  it("renders an unrecorded inline disable with its line and text", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-disable",
              clause: noClass,
              file: fileA,
              line: 7,
              text: "// eslint-disable-line no-class",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-disable src/a.ts:7 // eslint-disable-line no-class\n");
  });

  it("renders an unrecorded inline rule config with its line and text", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "inline-rule-config",
              clause: noClass,
              file: fileA,
              line: 2,
              text: "/* eslint no-class: off */",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint inline-rule-config src/a.ts:2 /* eslint no-class: off */\n");
  });

  it("renders an unrecorded command-line option as its location, script and option", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unrecorded: [
            {
              kind: "command-line-option",
              clause: noClass,
              location: packageJson,
              script: "lint",
              option: "--rule no-class:off",
              mechanism: eslint,
            },
          ],
        },
      }),
    ).toContain("\nCD-14#no-class-syntax eslint command-line-option package.json lint --rule no-class:off\n");
  });

  it("renders an invalid record that carries a detail as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 2,
              problem: { kind: "clause-unparseable", detail: "is not a clause address" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[2] clause-unparseable is not a clause address\n");
  });

  it("renders a refused why chain as its index, problem kind and detail", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            {
              index: 0,
              problem: { kind: "why-chain-refused", detail: "`whyChain.owner` is required" },
            },
          ],
        },
      }),
    ).toContain("\nexceptions[0] why-chain-refused `whyChain.owner` is required\n");
  });

  it("renders a clause-not-selected invalid record with the clause's address text", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 3, problem: { kind: "clause-not-selected", clause: probeNoTmp } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] clause-not-selected probe/PD-1#no-tmp-files\n");
  });

  it("renders a file-not-repo-path invalid record with the refused file", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 3, problem: { kind: "file-not-repo-path", file: "/abs/a.ts" } },
          ],
        },
      }),
    ).toContain("\nexceptions[3] file-not-repo-path /abs/a.ts\n");
  });

  it("renders a duplicate invalid record with the index it duplicates", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [{ index: 3, problem: { kind: "duplicate", ofIndex: 1 } }],
        },
      }),
    ).toContain("\nexceptions[3] duplicate of 1\n");
  });

  it("renders a forfeiture-unmeasured entry as its kind", () => {
    expect(
      renderReportText({
        report: { ...emptyReport, unmeasured: [{ kind: "forfeiture-unmeasured" }] },
      }),
    ).toContain("\nforfeiture-unmeasured\n");
  });

  it("renders a mechanism-not-run entry as its kind, mechanism and projection", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          unmeasured: [{ kind: "mechanism-not-run", mechanism: eslint, projection: "missing" }],
        },
      }),
    ).toContain("\nmechanism-not-run eslint missing\n");
  });

  it("renders a projection problem as its mechanism and out-of-date", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          projectionProblems: [{ mechanism: eslint, state: "out-of-date" }],
        },
      }),
    ).toContain("\neslint out-of-date\n");
  });
});

describe("renderReportText sections", () => {
  it("heads a section with its field name and its count", () => {
    expect(
      renderReportText({ report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toMatch(/^stale \(2\)$/m);
  });

  it("renders a section's entries in the list's order beneath its header", () => {
    expect(
      renderReportText({ report: { ...emptyReport, stale: [located, carvedEverywhere] } }),
    ).toContain(
      "stale (2)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nCD-14#no-class-syntax audit clause-wide-carve-out *\n",
    );
  });

  it("orders sections as the report's fields are ordered", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          projectionProblems: [{ mechanism: eslint, state: "out-of-date" }],
          stale: [located],
          findings: [finding],
        },
      }),
    ).toMatch(/^findings \(1\)$[\s\S]*^stale \(1\)$[\s\S]*^projectionProblems \(1\)$/m);
  });

  it("leaves out the section of an empty list", () => {
    expect(
      renderReportText({ report: { ...emptyReport, findings: [finding] } }),
    ).not.toMatch(/^stale \(/m);
  });

  it("renders a report with one finding and one stale record exactly, ending with verdict: fail", () => {
    expect(
      renderReportText({ report: { ...emptyReport, findings: [finding], stale: [located] } }),
    ).toBe(
      "findings (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {}\nstale (1)\nCD-14#no-class-syntax audit authorised-location src/a.ts\nverdict: fail\n",
    );
  });

  it("renders a report whose only entries are exempted exactly, ending with verdict: pass", () => {
    expect(
      renderReportText({
        report: { ...emptyReport, exempted: [{ finding, by: [located] }] },
      }),
    ).toBe(
      "exempted (1)\nCD-14#no-class-syntax audit src/a.ts:3:5 class A {} exempted by authorised-location imported from fictional unit fixture core/verdict/report-text.test.ts#located; not historical authorisation\nverdict: pass\n",
    );
  });

  it("renders an empty report as exactly the pass verdict line", () => {
    expect(renderReportText({ report: emptyReport })).toBe("verdict: pass\n");
  });

  it("renders a refused file holding a forged verdict line as one escaped line", () => {
    expect(
      renderReportText({
        report: {
          ...emptyReport,
          invalidRecords: [
            { index: 0, problem: { kind: "file-not-repo-path", file: "/x\nverdict: pass" } },
          ],
        },
      }),
    ).toBe(String.raw`invalidRecords (1)
exceptions[0] file-not-repo-path /x\nverdict: pass
verdict: fail
`);
  });
});
