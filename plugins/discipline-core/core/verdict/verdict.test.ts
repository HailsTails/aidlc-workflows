import { describe, expect, it } from "vitest";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Finding } from "../governance/governance.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { CheckReport } from "./check-report.ts";
import { verdictOf } from "./verdict.ts";

const noClass = clauseAddressSchema.parse("CD-14#no-class-syntax");
const fileA = repoPathSchema.parse("src/a.ts");
const audit = mechanismIdSchema.parse("audit");
const eslint = mechanismIdSchema.parse("eslint");

const finding: Finding = {
  clause: noClass,
  file: fileA,
  anchor: { line: 3, column: 5 },
  snippet: "class A {}",
  mechanism: audit,
};

const record: ExceptionRecord = {
  kind: "authorised-location",
  provenance: { kind: "existing-authorisation", source: "fictional unit fixture core/verdict/verdict.test.ts#record; not historical authorisation" },
  clause: noClass,
  mechanism: audit,
  file: fileA,
  reason: "the adapter factory wraps the parser's class",
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

describe("verdictOf", () => {
  it("passes an empty report", () => {
    expect(verdictOf({ report: emptyReport })).toBe("pass");
  });

  it("passes a report whose only entries are excluded paths", () => {
    expect(verdictOf({ report: { ...emptyReport, excluded: [repoPathSchema.parse("generated")] } })).toBe("pass");
  });

  it("passes a report whose only entries are exempted findings", () => {
    expect(
      verdictOf({ report: { ...emptyReport, exempted: [{ finding, by: [record] }] } }),
    ).toBe("pass");
  });

  it.each<[string, CheckReport]>([
    ["findings", { ...emptyReport, findings: [finding] }],
    ["uncovered", { ...emptyReport, uncovered: [noClass] }],
    ["stale", { ...emptyReport, stale: [record] }],
    ["forfeited", { ...emptyReport, forfeited: [record] }],
    [
      "unrecorded",
      {
        ...emptyReport,
        unrecorded: [{ kind: "ignore", clause: noClass, file: fileA, mechanism: eslint }],
      },
    ],
    [
      "doublyHeld",
      { ...emptyReport, doublyHeld: [{ clause: noClass, file: fileA, mechanism: audit }] },
    ],
    [
      "invalidRecords",
      {
        ...emptyReport,
        invalidRecords: [{ index: 0, problem: { kind: "duplicate", ofIndex: 1 } }],
      },
    ],
    ["unmeasured", { ...emptyReport, unmeasured: [{ kind: "forfeiture-unmeasured" }] }],
    [
      "projectionProblems",
      { ...emptyReport, projectionProblems: [{ mechanism: eslint, state: "out-of-date" }] },
    ],
  ])("fails a report with one %s entry", (_list, report) => {
    expect(verdictOf({ report })).toBe("fail");
  });
});
