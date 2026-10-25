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
  mergeability: "clean",
};

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi
    .fn<GitHubRepositoryPort["listReviews"]>()
    .mockResolvedValue(succeed([{ stance: "approved", reviewedSha: "head8" }])),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi
    .fn<GitHubRepositoryPort["squashMerge"]>()
    .mockResolvedValue(succeed({ mergeSha: "merge8" })),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

describe("mergePullRequest", () => {
  it("squash-merges an approved head, pinning the head GitHub must still see", async () => {
    const repositoryApi = fakeRepositoryApi();

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(succeed({ mergeSha: "merge8" }));
    expect(repositoryApi.squashMerge).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node8",
      expectedHeadSha: "head8",
    });
  });

  it("refuses without an approving verdict and never calls merge", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.listReviews.mockResolvedValue(succeed([]));

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(
      fail({ kind: "approval-missing", pullNumber: 8, latestStance: "no-verdict" }),
    );
    expect(repositoryApi.squashMerge).not.toHaveBeenCalled();
  });

  it("passes a failed review listing through", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.listReviews.mockResolvedValue(
      fail({ kind: "github-unreachable", operation: "list reviews" }),
    );

    const merged = await mergePullRequest({ repositoryApi, pullNumber: 8 });

    expect(merged).toEqual(fail({ kind: "github-unreachable", operation: "list reviews" }));
    expect(repositoryApi.squashMerge).not.toHaveBeenCalled();
  });
});
