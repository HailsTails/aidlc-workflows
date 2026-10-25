import { describe, expect, it, vi } from "vitest";
import { succeed } from "../domain/result.ts";
import { commentOnIssue } from "./comment-on-issue.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";

const commentUrl = "https://github.com/HailsTails/minutesarah-shop/pull/5#issuecomment-1";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi
    .fn<GitHubRepositoryPort["commentOnIssue"]>()
    .mockResolvedValue(succeed({ url: commentUrl })),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

describe("commentOnIssue", () => {
  it("posts an attributed comment, sessioned by the issue number by default", async () => {
    const repositoryApi = fakeRepositoryApi();

    const commented = await commentOnIssue({
      repositoryApi,
      role: "author",
      issueNumber: 5,
      authoredBody: "Rebased on main.",
      session: undefined,
    });

    expect(commented).toEqual(succeed({ url: commentUrl }));
    expect(repositoryApi.commentOnIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 5,
      body: "<!-- rin-bot: role=author session=5 -->\n\nRebased on main.",
    });
  });

  it("uses the named session in the marker", async () => {
    const repositoryApi = fakeRepositoryApi();

    await commentOnIssue({
      repositoryApi,
      role: "reviewer",
      issueNumber: 5,
      authoredBody: "Looking now.",
      session: "review-3",
    });

    expect(repositoryApi.commentOnIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 5,
      body: "<!-- rin-bot: role=reviewer session=review-3 -->\n\nLooking now.",
    });
  });
});
