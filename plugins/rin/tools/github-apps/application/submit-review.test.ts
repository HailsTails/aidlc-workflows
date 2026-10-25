import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { submitReview } from "./submit-review.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 6,
  nodeId: "PR_node6",
  headSha: "head6",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeability: "clean",
};

const reviewUrl = "https://github.com/HailsTails/minutesarah-shop/pull/6#pullrequestreview-1";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn(),
  submitReview: vi
    .fn<GitHubRepositoryPort["submitReview"]>()
    .mockResolvedValue(succeed({ url: reviewUrl })),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

const review = {
  role: "reviewer",
  pullNumber: 6,
  event: "approve",
  authoredBody: "Looks right.",
  session: undefined,
} as const;

describe("submitReview", () => {
  it("posts an attributed verdict bound to the head it read", async () => {
    const repositoryApi = fakeRepositoryApi();

    const reviewed = await submitReview({ ...review, repositoryApi, reviewedSha: undefined });

    expect(reviewed).toEqual(succeed({ url: reviewUrl }));
    expect(repositoryApi.submitReview).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node6",
      event: "approve",
      commitSha: "head6",
      body: "<!-- rin-bot: role=reviewer session=6 -->\n\nLooks right.",
    });
  });

  it("refuses a verdict on a head the reviewer did not read", async () => {
    const repositoryApi = fakeRepositoryApi();

    const reviewed = await submitReview({ ...review, repositoryApi, reviewedSha: "head5" });

    expect(reviewed).toEqual(
      fail({ kind: "reviewed-head-moved", pullNumber: 6, reviewedSha: "head5", headSha: "head6" }),
    );
    expect(repositoryApi.submitReview).not.toHaveBeenCalled();
  });

  it("refuses a verdict on a pull request that already merged", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.readPullRequest.mockResolvedValue(
      succeed({ ...pullRequest, lifecycle: "merged" }),
    );

    const reviewed = await submitReview({ ...review, repositoryApi, reviewedSha: undefined });

    expect(reviewed).toEqual(
      fail({ kind: "pull-request-not-open", pullNumber: 6, lifecycle: "merged" }),
    );
  });
});
