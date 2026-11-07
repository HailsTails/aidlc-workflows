import { describe, expect, it } from "vitest";
import { assessClose } from "./close-guard.ts";
import type { PullRequestSnapshot } from "./pull-request.ts";

const supersededPullRequest: PullRequestSnapshot = {
  pullNumber: 7,
  nodeId: "PR_node7",
  headSha: "head7",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "blocked",
};

describe("assessClose", () => {
  it("clears an open pull request that is not both approved and mergeable", () => {
    expect(
      assessClose({
        pullRequest: supersededPullRequest,
        reviews: [{ stance: "approved", reviewedSha: "head7" }],
      }),
    ).toEqual({ kind: "success", outcome: { pullNumber: 7 } });
  });

  it("refuses to close an approved, mergeable pull request so it is merged instead", () => {
    expect(
      assessClose({
        pullRequest: { ...supersededPullRequest, mergeState: "clean" },
        reviews: [{ stance: "approved", reviewedSha: "head7" }],
      }),
    ).toEqual({ kind: "failure", reason: { kind: "approved-and-mergeable", pullNumber: 7 } });
  });

  it("refuses a pull request that is already closed", () => {
    expect(
      assessClose({ pullRequest: { ...supersededPullRequest, lifecycle: "closed" }, reviews: [] }),
    ).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 7, lifecycle: "closed" },
    });
  });
});
