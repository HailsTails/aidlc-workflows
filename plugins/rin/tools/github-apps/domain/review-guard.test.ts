import { describe, expect, it } from "vitest";
import type { PullRequestSnapshot } from "./pull-request.ts";
import { assessReviewTarget } from "./review-guard.ts";

const pullRequestUnderReview: PullRequestSnapshot = {
  pullNumber: 3,
  nodeId: "PR_node3",
  headSha: "head3",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

describe("assessReviewTarget", () => {
  it("binds the review to the head it observed when the reviewer names no sha", () => {
    expect(
      assessReviewTarget({ pullRequest: pullRequestUnderReview, reviewedSha: undefined }),
    ).toEqual({ kind: "success", outcome: { pullNumber: 3, commitSha: "head3" } });
  });

  it("binds the review to the reviewed sha when it is still the head", () => {
    expect(
      assessReviewTarget({ pullRequest: pullRequestUnderReview, reviewedSha: "head3" }),
    ).toEqual({ kind: "success", outcome: { pullNumber: 3, commitSha: "head3" } });
  });

  it("refuses a review of a head that has since moved", () => {
    expect(
      assessReviewTarget({ pullRequest: pullRequestUnderReview, reviewedSha: "head2" }),
    ).toEqual({
      kind: "failure",
      reason: {
        kind: "reviewed-head-moved",
        pullNumber: 3,
        reviewedSha: "head2",
        headSha: "head3",
      },
    });
  });

  it("refuses a review of a pull request that already merged", () => {
    expect(
      assessReviewTarget({
        pullRequest: { ...pullRequestUnderReview, lifecycle: "merged" },
        reviewedSha: undefined,
      }),
    ).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 3, lifecycle: "merged" },
    });
  });
});
