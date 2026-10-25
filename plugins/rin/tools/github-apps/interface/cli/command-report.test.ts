import { describe, expect, it } from "vitest";
import { reportLine } from "./command-report.ts";

describe("reportLine", () => {
  it("prints one line to standard output and nothing to standard error", () => {
    expect(reportLine("Merged #4")).toEqual({ standardOutput: "Merged #4\n", standardError: "" });
  });
});
