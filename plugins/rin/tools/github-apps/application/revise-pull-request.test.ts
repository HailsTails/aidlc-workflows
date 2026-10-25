import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { revisePullRequest } from "./revise-pull-request.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 5,
  nodeId: "PR_node5",
  headSha: "head5",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeability: "clean",
};

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/5";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi
    .fn<GitHubRepositoryPort["revisePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

describe("revisePullRequest", () => {
  it("replaces the body with an attributed one, sessioned by the pull number", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await revisePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 5,
      title: undefined,
      authoredBody: "Now with totals.",
      session: undefined,
    });

    expect(revised).toEqual(succeed({ url: pullRequestUrl }));
    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: undefined,
      body: "<!-- rin-bot: role=author session=5 -->\n\nNow with totals.",
    });
  });

  it("retitles without touching the body", async () => {
    const repositoryApi = fakeRepositoryApi();

    await revisePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 5,
      title: "Add basket totals",
      authoredBody: undefined,
      session: undefined,
    });

    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: "Add basket totals",
      body: undefined,
    });
  });

  it("refuses a revision that changes nothing", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await revisePullRequest({
      repositoryApi,
      role: "author",
      pullNumber: 5,
      title: undefined,
      authoredBody: undefined,
      session: undefined,
    });

    expect(revised).toEqual(fail({ kind: "nothing-to-revise", pullNumber: 5 }));
    expect(repositoryApi.readPullRequest).not.toHaveBeenCalled();
  });
});
