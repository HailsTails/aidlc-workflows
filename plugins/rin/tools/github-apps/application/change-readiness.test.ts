import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import { changeReadiness } from "./change-readiness.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 11,
  nodeId: "PR_node11",
  headSha: "head11",
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
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi
    .fn<GitHubRepositoryPort["changeReadiness"]>()
    .mockResolvedValue(succeed("draft")),
});

describe("changeReadiness", () => {
  it("converts an open pull request to a draft", async () => {
    const repositoryApi = fakeRepositoryApi();

    const changed = await changeReadiness({ repositoryApi, pullNumber: 11, readiness: "draft" });

    expect(changed).toEqual(succeed("draft"));
    expect(repositoryApi.changeReadiness).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node11",
      readiness: "draft",
    });
  });

  it("refuses to change a closed pull request", async () => {
    const repositoryApi = fakeRepositoryApi();
    repositoryApi.readPullRequest.mockResolvedValue(
      succeed({ ...pullRequest, lifecycle: "closed" }),
    );

    const changed = await changeReadiness({
      repositoryApi,
      pullNumber: 11,
      readiness: "ready-for-review",
    });

    expect(changed).toEqual(
      fail({ kind: "pull-request-not-open", pullNumber: 11, lifecycle: "closed" }),
    );
    expect(repositoryApi.changeReadiness).not.toHaveBeenCalled();
  });
});
