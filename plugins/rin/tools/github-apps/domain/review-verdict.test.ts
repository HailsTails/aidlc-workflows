import { describe, expect, it } from "vitest";
import { latestVerdict } from "./review-verdict.ts";

describe("latestVerdict", () => {
  it("is the most recent approval or change request, skipping plain comments", () => {
    expect(
      latestVerdict([
        { stance: "changes-requested", reviewedSha: "first" },
        { stance: "approved", reviewedSha: "second" },
        { stance: "commented", reviewedSha: "third" },
        { stance: "dismissed", reviewedSha: "fourth" },
      ]),
    ).toEqual({ stance: "approved", reviewedSha: "second" });
  });

  it("is absent when no review carries a verdict", () => {
    expect(latestVerdict([{ stance: "commented", reviewedSha: "only" }])).toBeUndefined();
  });
});
