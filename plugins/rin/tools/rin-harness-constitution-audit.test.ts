import { expect, test } from "vitest";
import {
  type AuditViolation,
  cdIdOf,
  formatSummary,
} from "./rin-harness-constitution-audit.ts";

const violation = ({
  rule,
  file,
}: {
  readonly rule: string;
  readonly file: string;
}): AuditViolation => ({ rule, file, line: 1, snippet: "snippet" });

test("cdIdOf takes the rule id ahead of its parenthesised description", () => {
  expect(cdIdOf("CD-43 (boolean type field — booleans are evaluative)")).toBe(
    "CD-43",
  );
});

test("cdIdOf returns the whole rule when it carries no description", () => {
  expect(cdIdOf("CD-15")).toBe("CD-15");
});

test("a clean run summarises nothing", () => {
  expect(formatSummary({ violations: [], scannedCount: 1914 })).toBe("");
});

test("the summary counts violations, offending files and the scanned denominator", () => {
  const summary = formatSummary({
    violations: [
      violation({ rule: "CD-43 (boolean)", file: "a.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "b.ts" }),
    ],
    scannedCount: 1914,
  });
  expect(summary).toContain("2 violation(s) across 2 file(s) of 1914 scanned.");
});

test("the by-rule roll-up reports each rule's violation count", () => {
  const summary = formatSummary({
    violations: [
      violation({ rule: "CD-43 (boolean)", file: "a.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "b.ts" }),
      violation({ rule: "CD-15 (for-of)", file: "c.ts" }),
    ],
    scannedCount: 10,
  });
  expect(summary).toContain("CD-43         2 across 2 file(s)");
});

test("the by-rule roll-up reports how many files each rule spans", () => {
  const summary = formatSummary({
    violations: [
      violation({ rule: "CD-43 (boolean)", file: "a.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "a.ts" }),
    ],
    scannedCount: 10,
  });
  expect(summary).toContain("CD-43         2 across 1 file(s)");
});

test("the by-rule roll-up ranks the most-violated rule first", () => {
  const summary = formatSummary({
    violations: [
      violation({ rule: "CD-15 (for-of)", file: "c.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "a.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "b.ts" }),
    ],
    scannedCount: 10,
  });
  expect(summary.indexOf("CD-43")).toBeLessThan(summary.indexOf("CD-15"));
});

test("the worst-files list ranks the most-violated file first", () => {
  const summary = formatSummary({
    violations: [
      violation({ rule: "CD-43 (boolean)", file: "quiet.ts" }),
      violation({ rule: "CD-43 (boolean)", file: "noisy.ts" }),
      violation({ rule: "CD-15 (for-of)", file: "noisy.ts" }),
    ],
    scannedCount: 10,
  });
  expect(summary.indexOf("noisy.ts")).toBeLessThan(summary.indexOf("quiet.ts"));
});

test("the worst-files list caps at ten entries and says how many it omitted", () => {
  const summary = formatSummary({
    violations: Array.from({ length: 12 }, (_unused, index) =>
      violation({ rule: "CD-43 (boolean)", file: `file-${index}.ts` }),
    ),
    scannedCount: 100,
  });
  expect(summary).toContain("… and 2 more file(s)");
});

test("the worst-files list omits the overflow note when every file fits", () => {
  const summary = formatSummary({
    violations: [violation({ rule: "CD-43 (boolean)", file: "a.ts" })],
    scannedCount: 100,
  });
  expect(summary).not.toContain("more file(s)");
});
