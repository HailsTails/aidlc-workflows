import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { mergePullRequest } from "./merge-pull-request.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 8,
  nodeId: "PR_node8",
  headSha: "head8",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi
    .fn<GitHubRepositoryPort["squashMerge"]>()
    .mockResolvedValue(succeed({ mergeSha: "merge8" })),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

describe("mergePullRequest", () => {
  it("squash-merges a clean head, pinning the head GitHub must still see", async () => {
    const repositoryApi = fakeRepositoryApi();

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(succeed({ mergeSha: "merge8" }));
    expect(repositoryApi.squashMerge).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node8",
      expectedHeadSha: "head8",
    });
  });

  it("refuses a head the ruleset still blocks and never calls merge", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.readPullRequest.mockResolvedValue(
      succeed({ ...pullRequest, mergeState: "blocked" }),
    );

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(
      fail({ kind: "pull-request-not-mergeable", pullNumber: 8, mergeState: "blocked" }),
    );
    expect(repositoryApi.squashMerge).not.toHaveBeenCalled();
  });

  it("passes a failed pull request read through", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.readPullRequest.mockResolvedValue(
      fail({ kind: "github-unreachable", operation: "read pull request" }),
    );

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(fail({ kind: "github-unreachable", operation: "read pull request" }));
    expect(repositoryApi.squashMerge).not.toHaveBeenCalled();
  });
});
