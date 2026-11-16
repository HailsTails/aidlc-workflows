import { describe, expect, it } from "vitest";
import { type ReportSection, printedSectionLines } from "./section-selection.ts";

const findings: ReportSection = {
  name: "findings",
  lines: ["CD-14#class-syntax audit src/a.ts:3:0 class A {}", "CD-14#class-syntax audit src/b.ts:1:0 class B {}"],
};

const excluded: ReportSection = { name: "excluded", lines: ["generated"] };

const exempted: ReportSection = {
  name: "exempted",
  lines: ["CD-17#clock-sources audit src/clock.ts:2:9 Date.now() exempted by authorised-location"],
};

describe("printedSectionLines", () => {
  it("prints a section's heading and every entry for the full output", () => {
    expect(printedSectionLines({ output: "full", section: findings })).toEqual(["findings (2)", ...findings.lines]);
  });

  it("prints an informational section's heading and entries for the full output", () => {
    expect(printedSectionLines({ output: "full", section: excluded })).toEqual(["excluded (1)", "generated"]);
  });

  it("prints a failing section's heading and every entry for the failures-only output", () => {
    expect(printedSectionLines({ output: "failures-only", section: findings })).toEqual([
      "findings (2)",
      ...findings.lines,
    ]);
  });

  it.each([excluded, exempted])("prints nothing of the informational $name section for the failures-only output", (section) => {
    expect(printedSectionLines({ output: "failures-only", section })).toEqual([]);
  });

  it.each<[ReportSection, string]>([
    [findings, "findings (2)"],
    [excluded, "excluded (1)"],
    [exempted, "exempted (1)"],
  ])("prints only the heading with its count for the counts output", (section, heading) => {
    expect(printedSectionLines({ output: "counts", section })).toEqual([heading]);
  });

  it.each([findings, excluded, exempted])("prints nothing of the $name section for the verdict-only output", (section) => {
    expect(printedSectionLines({ output: "verdict-only", section })).toEqual([]);
  });
});
