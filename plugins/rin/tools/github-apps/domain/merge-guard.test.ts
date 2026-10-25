import { describe, expect, it } from "vitest";
import { assessMerge } from "./merge-guard.ts";
import type { PullRequestSnapshot } from "./pull-request.ts";

const readyPullRequest: PullRequestSnapshot = {
  pullNumber: 4,
  nodeId: "PR_node4",
  headSha: "head4",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeability: "clean",
};

describe("assessMerge", () => {
  it("clears an open pull request whose latest verdict approves its current head", () => {
    expect(
      assessMerge({
        pullRequest: readyPullRequest,
        reviews: [
          { stance: "changes-requested", reviewedSha: "older" },
          { stance: "approved", reviewedSha: "head4" },
        ],
      }),
    ).toEqual({ kind: "success", outcome: { pullNumber: 4, headSha: "head4" } });
  });

  it("refuses a pull request that is no longer open", () => {
    expect(
      assessMerge({ pullRequest: { ...readyPullRequest, lifecycle: "merged" }, reviews: [] }),
    ).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 4, lifecycle: "merged" },
    });
  });

  it("refuses a draft", () => {
    expect(
      assessMerge({
        pullRequest: { ...readyPullRequest, readiness: "draft" },
        reviews: [{ stance: "approved", reviewedSha: "head4" }],
      }),
    ).toEqual({ kind: "failure", reason: { kind: "pull-request-is-draft", pullNumber: 4 } });
  });
});

describe("assessMerge on the review verdict", () => {
  it("refuses without any verdict", () => {
    expect(
      assessMerge({
        pullRequest: readyPullRequest,
        reviews: [{ stance: "commented", reviewedSha: "head4" }],
      }),
    ).toEqual({
      kind: "failure",
      reason: { kind: "approval-missing", pullNumber: 4, latestStance: "no-verdict" },
    });
  });

  it("refuses when the latest verdict requests changes, even after an earlier approval", () => {
    expect(
      assessMerge({
        pullRequest: readyPullRequest,
        reviews: [
          { stance: "approved", reviewedSha: "head4" },
          { stance: "changes-requested", reviewedSha: "head4" },
        ],
      }),
    ).toEqual({
      kind: "failure",
      reason: { kind: "approval-missing", pullNumber: 4, latestStance: "changes-requested" },
    });
  });

  it("refuses an approval of a head that has since moved", () => {
    expect(
      assessMerge({
        pullRequest: readyPullRequest,
        reviews: [{ stance: "approved", reviewedSha: "head3" }],
      }),
    ).toEqual({
      kind: "failure",
      reason: {
        kind: "approval-on-stale-head",
        pullNumber: 4,
        approvedSha: "head3",
        headSha: "head4",
      },
    });
  });
});
