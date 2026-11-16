import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { repoPathSchema } from "../core/values/repo-path.ts";
import type { CheckReport } from "../core/verdict/check-report.ts";
import { fullReportExitCode } from "./full-report-exit-code.ts";

const EMPTY_REPORT: CheckReport = {
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

describe("fullReportExitCode", () => {
  it("is 0 for a loaded report that passes", () => {
    expect(fullReportExitCode({ checked: { outcome: "ok", value: EMPTY_REPORT } })).toBe(0);
  });

  it("is 1 for a loaded report that fails", () => {
    expect(
      fullReportExitCode({
        checked: {
          outcome: "ok",
          value: {
            ...EMPTY_REPORT,
            findings: [
              {
                clause: clauseAddressSchema.parse("CD-14#class-syntax"),
                file: repoPathSchema.parse("src/a.ts"),
                anchor: { line: 1, column: 0 },
                snippet: "class A {}",
                mechanism: mechanismIdSchema.parse("audit"),
              },
            ],
          },
        },
      }),
    ).toBe(1);
  });

  it("is 2 for a check that did not load", () => {
    expect(
      fullReportExitCode({ checked: { outcome: "failed", error: { kind: "git-failed", detail: "not a repository" } } }),
    ).toBe(2);
  });
});
