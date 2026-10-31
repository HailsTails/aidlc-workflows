import { describe, expect, test } from "vitest";
import { disciplinesReportSectionsOf, failingSectionsOf, findingsOf, remedyOf } from "./rin-disciplines-report.ts";

const FAILING_REPORT = [
  "excluded (1)",
  "tools/discipline-core",
  "findings (2)",
  "CD-15#loops audit src/loop.ts:3:2 let total = 0;",
  "CD-1#explicit-any eslint src/any.ts:1:14 ",
  "exempted (1)",
  "CD-2#cast-expressions audit src/cast.ts:4:1 x as Y exempted by file-carve-out",
  "forfeited (1)",
  "CD-19#import-boundaries audit file-carve-out src/old.ts",
  "verdict: fail",
  "",
].join("\n");

describe("discipline-core report text", () => {
  test("splits the report into its named sections and drops the verdict line", () => {
    expect(disciplinesReportSectionsOf({ report: FAILING_REPORT }).map((section) => section.name)).toEqual([
      "excluded",
      "findings",
      "exempted",
      "forfeited",
    ]);
  });

  test("keeps only the sections that fail a run", () => {
    expect(failingSectionsOf({ report: FAILING_REPORT }).map((section) => section.name)).toEqual(["findings", "forfeited"]);
  });

  test("reads each finding line into its clause, mechanism, file, position and snippet", () => {
    expect(findingsOf({ report: FAILING_REPORT })).toEqual([
      { clause: "CD-15#loops", mechanism: "audit", file: "src/loop.ts", line: 3, column: 2, snippet: "let total = 0;" },
      { clause: "CD-1#explicit-any", mechanism: "eslint", file: "src/any.ts", line: 1, column: 14, snippet: "" },
    ]);
  });

  test("names the remedy of a failing section", () => {
    const forfeited = { name: "forfeited", header: "forfeited (1)", lines: [] } as const;
    expect(remedyOf({ section: forfeited })).toBe(
      "To fix forfeited: the carved-out file was touched, so make the whole file comply and delete its carve-out (CD-46).",
    );
  });

  test("reads a CRLF report the same as an LF one", () => {
    expect(findingsOf({ report: FAILING_REPORT.replaceAll("\n", "\r\n") })).toHaveLength(2);
  });
});
