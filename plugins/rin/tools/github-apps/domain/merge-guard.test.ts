import { describe, expect, it } from "vitest";
import { assessMerge } from "./merge-guard.ts";
import type { PullRequestSnapshot } from "./pull-request.ts";

const readyPullRequest: PullRequestSnapshot = {
  pullNumber: 4,
  nodeId: "PR_node4",
  headSha: "head4",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

describe("assessMerge", () => {
  it("clears an open, ready pull request GitHub reports as cleanly mergeable", () => {
    expect(assessMerge(readyPullRequest)).toEqual({
      kind: "success",
      outcome: { pullNumber: 4, headSha: "head4" },
    });
  });

  it("refuses a pull request that is no longer open", () => {
    expect(assessMerge({ ...readyPullRequest, lifecycle: "merged" })).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 4, lifecycle: "merged" },
    });
  });

  it("refuses a draft", () => {
    expect(
      assessMerge({ ...readyPullRequest, readiness: "draft", mergeState: "draft" }),
    ).toEqual({ kind: "failure", reason: { kind: "pull-request-is-draft", pullNumber: 4 } });
  });

  it.each([
    ["a required review or check is outstanding", "blocked"],
    ["checks are failing or still pending", "unstable"],
    ["it conflicts with the base branch", "dirty"],
    ["it is behind the base branch", "behind"],
    ["GitHub has not computed the state yet", "unknown"],
  ] as const)("refuses, naming the state, when %s", (_why, mergeState) => {
    expect(assessMerge({ ...readyPullRequest, mergeState })).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-mergeable", pullNumber: 4, mergeState },
    });
  });
});
