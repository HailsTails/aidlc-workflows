import { describe, expect, it } from "vitest";
import { describeCliFailure } from "./cli-failure.ts";

describe("describeCliFailure", () => {
  it("explains a merge refused for a missing approval", () => {
    expect(
      describeCliFailure({ kind: "approval-missing", pullNumber: 4, latestStance: "no-verdict" }),
    ).toBe("#4 cannot merge: no review has given a verdict; merging requires an approval.");
  });

  it("explains an approval left behind by a newer push, with short shas", () => {
    expect(
      describeCliFailure({
        kind: "approval-on-stale-head",
        pullNumber: 4,
        approvedSha: "0123456789abcdef",
        headSha: "fedcba9876543210",
      }),
    ).toBe(
      "#4 was approved at 01234567 but its head is now fedcba98; re-review the current head before merging.",
    );
  });

  it("names the repository an app is missing from", () => {
    expect(
      describeCliFailure({
        kind: "app-not-installed",
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
      }),
    ).toBe(
      "The GitHub App is not installed on HailsTails/minutesarah-shop; install it there first.",
    );
  });

  it("explains a GitHub rejection with its status", () => {
    expect(
      describeCliFailure({
        kind: "github-rejected",
        operation: "squash merge",
        status: 200,
        detail: "Head sha didn't match expected",
      }),
    ).toBe("GitHub refused to squash merge (200): Head sha didn't match expected");
  });
});
