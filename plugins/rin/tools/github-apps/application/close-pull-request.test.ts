import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import { closePullRequest } from "./close-pull-request.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 2,
  nodeId: "PR_node2",
  headSha: "head2",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "blocked",
};

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/2";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn<GitHubRepositoryPort["listReviews"]>().mockResolvedValue(succeed([])),
  submitReview: vi.fn(),
  commentOnIssue: vi
    .fn<GitHubRepositoryPort["commentOnIssue"]>()
    .mockResolvedValue(succeed({ url: `${pullRequestUrl}#issuecomment-1` })),
  squashMerge: vi.fn(),
  closePullRequest: vi
    .fn<GitHubRepositoryPort["closePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  changeReadiness: vi.fn(),
});

describe("closePullRequest", () => {
  it("explains the supersession in an attributed comment, then closes", async () => {
    const repositoryApi = fakeRepositoryApi();

    const closed = await closePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 2,
      reason: "replaced by #9",
    });

    expect(closed).toEqual(succeed({ url: pullRequestUrl }));
    expect(repositoryApi.commentOnIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 2,
      body: "<!-- rin-bot: role=author session=2 -->\n\nsuperseded: replaced by #9",
    });
    expect(repositoryApi.closePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node2",
    });
  });

  it("refuses to close an approved, mergeable pull request", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.readPullRequest.mockResolvedValue(
      succeed({ ...pullRequest, mergeState: "clean" }),
    );
    repositoryApi.listReviews.mockResolvedValue(
      succeed([{ stance: "approved", reviewedSha: "head2" }]),
    );

    const closed = await closePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 2,
      reason: "stale",
    });

    expect(closed).toEqual(fail({ kind: "approved-and-mergeable", pullNumber: 2 }));
    expect(repositoryApi.commentOnIssue).not.toHaveBeenCalled();
    expect(repositoryApi.closePullRequest).not.toHaveBeenCalled();
  });

  it("leaves the pull request open when the explanation cannot be posted", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.commentOnIssue.mockResolvedValue(
      fail({ kind: "github-unreachable", operation: "comment on issue" }),
    );

    const closed = await closePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 2,
      reason: "stale",
    });

    expect(closed).toEqual(fail({ kind: "github-unreachable", operation: "comment on issue" }));
    expect(repositoryApi.closePullRequest).not.toHaveBeenCalled();
  });
});
