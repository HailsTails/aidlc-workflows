import { describe, expect, it } from "vitest";
import { sectionsWithRole } from "./section-roles.ts";
import { type ReportSection, printedSectionLines } from "./section-selection.ts";

const ENTRIES = ["first entry", "second entry"];

const FAILING_SECTIONS = sectionsWithRole({ role: "failing" });

const INFORMATIONAL_SECTIONS = sectionsWithRole({ role: "informational" });

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

  it.each(FAILING_SECTIONS)("prints the failing %s section's heading and every entry for the failures-only output", (name) => {
    expect(printedSectionLines({ output: "failures-only", section: { name, lines: ENTRIES } })).toEqual([
      `${name} (2)`,
      ...ENTRIES,
    ]);
  });

  it.each(INFORMATIONAL_SECTIONS)("prints nothing of the informational %s section for the failures-only output", (name) => {
    expect(printedSectionLines({ output: "failures-only", section: { name, lines: ENTRIES } })).toEqual([]);
  });

  it.each(FAILING_SECTIONS)("prints only the failing %s section's heading with its count for the counts output", (name) => {
    expect(printedSectionLines({ output: "counts", section: { name, lines: ENTRIES } })).toEqual([`${name} (2)`]);
  });

  it.each(INFORMATIONAL_SECTIONS)(
    "prints the informational %s section's heading with its count, marked informational, for the counts output",
    (name) => {
      expect(printedSectionLines({ output: "counts", section: { name, lines: ENTRIES } })).toEqual([
        `${name} (2) informational`,
      ]);
    },
  );

  it.each([findings, excluded, exempted])("prints nothing of the $name section for the verdict-only output", (section) => {
    expect(printedSectionLines({ output: "verdict-only", section })).toEqual([]);
  });
});
