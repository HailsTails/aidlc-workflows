import { describe, expect, it } from "vitest";
import { requireOpenPullRequest, type PullRequestSnapshot } from "./pull-request.ts";

const openPullRequest: PullRequestSnapshot = {
  pullNumber: 9,
  nodeId: "PR_node9",
  headSha: "head9",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

describe("requireOpenPullRequest", () => {
  it("passes an open pull request through", () => {
    expect(requireOpenPullRequest(openPullRequest)).toEqual({
      kind: "success",
      outcome: openPullRequest,
    });
  });

  it("refuses a merged pull request, naming its lifecycle", () => {
    expect(requireOpenPullRequest({ ...openPullRequest, lifecycle: "merged" })).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 9, lifecycle: "merged" },
    });
  });

  it("refuses a closed pull request", () => {
    expect(requireOpenPullRequest({ ...openPullRequest, lifecycle: "closed" })).toEqual({
      kind: "failure",
      reason: { kind: "pull-request-not-open", pullNumber: 9, lifecycle: "closed" },
    });
  });
});
