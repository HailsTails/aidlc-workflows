import { describe, expect, it } from "vitest";
import { REPORT_OUTPUTS, type ReportOutput, reportOutputInEffect, reportOutputSchema } from "./report-output.ts";

describe("reportOutputSchema", () => {
  it.each(["full", "failures-only", "counts", "verdict-only"])("accepts %s", (output) => {
    expect(reportOutputSchema.safeParse(output)).toEqual({ success: true, data: output });
  });

  it.each(["summary", "", "Full", "quiet", true])("refuses %j", (output) => {
    expect(reportOutputSchema.safeParse(output).success).toBe(false);
  });
});

describe("REPORT_OUTPUTS", () => {
  it("lists the four outputs with the full report first", () => {
    expect(REPORT_OUTPUTS).toEqual(["full", "failures-only", "counts", "verdict-only"]);
  });
});

describe("reportOutputInEffect", () => {
  it("is the configured output when no output is requested for the run", () => {
    expect(reportOutputInEffect({ requested: undefined, configured: "counts" })).toBe("counts");
  });

  it.each<[ReportOutput, ReportOutput]>([
    ["full", "verdict-only"],
    ["failures-only", "full"],
    ["counts", "failures-only"],
    ["verdict-only", "counts"],
  ])("is the requested %s over the configured %s", (requested, configured) => {
    expect(reportOutputInEffect({ requested, configured })).toBe(requested);
  });

  it("is the requested output when it matches the configured one", () => {
    expect(reportOutputInEffect({ requested: "failures-only", configured: "failures-only" })).toBe("failures-only");
  });
});
