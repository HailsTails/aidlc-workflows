import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import type { GitWorktreePort } from "./git-worktree-port.ts";
import { openPullRequest } from "./open-pull-request.ts";

const fakeRepositoryApi = () => ({
  openPullRequest: vi
    .fn<GitHubRepositoryPort["openPullRequest"]>()
    .mockResolvedValue(succeed({ url: "https://github.com/HailsTails/minutesarah-shop/pull/5" })),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

const fakeWorktree = () => ({
  readCurrentBranch: vi
    .fn<GitWorktreePort["readCurrentBranch"]>()
    .mockResolvedValue(succeed("feature/basket")),
  readCheckoutKind: vi.fn(),
  configureWorktree: vi.fn(),
});

const opening = {
  role: "author",
  title: "Add the basket",
  authoredBody: "Adds the basket.",
  base: "main",
  readiness: "ready-for-review",
} as const;

describe("openPullRequest", () => {
  it("opens from the current branch with the provenance marker naming that branch", async () => {
    const repositoryApi = fakeRepositoryApi();

    const opened = await openPullRequest({
      ...opening,
      repositoryApi,
      worktree: fakeWorktree(),
      head: undefined,
      session: undefined,
    });

    expect(opened).toEqual(
      succeed({ url: "https://github.com/HailsTails/minutesarah-shop/pull/5" }),
    );
    expect(repositoryApi.openPullRequest).toHaveBeenCalledExactlyOnceWith({
      title: "Add the basket",
      head: "feature/basket",
      base: "main",
      readiness: "ready-for-review",
      body: "<!-- rin-bot: role=author session=feature/basket -->\n\nAdds the basket.",
    });
  });

  it("opens from a named head and session without asking git", async () => {
    const repositoryApi = fakeRepositoryApi();
    const worktree = fakeWorktree();

    await openPullRequest({
      ...opening,
      repositoryApi,
      worktree,
      head: "feature/checkout",
      session: "session-9",
    });

    expect(worktree.readCurrentBranch).not.toHaveBeenCalled();
    expect(repositoryApi.openPullRequest).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        head: "feature/checkout",
        body: "<!-- rin-bot: role=author session=session-9 -->\n\nAdds the basket.",
      }),
    );
  });
});

describe("openPullRequest refusals", () => {
  it("refuses to open from a detached head", async () => {
    const repositoryApi = fakeRepositoryApi();
    const worktree = fakeWorktree();
    worktree.readCurrentBranch.mockResolvedValue(fail({ kind: "branch-detached" }));

    const opened = await openPullRequest({
      ...opening,
      repositoryApi,
      worktree,
      head: undefined,
      session: undefined,
    });

    expect(opened).toEqual(fail({ kind: "branch-detached" }));
    expect(repositoryApi.openPullRequest).not.toHaveBeenCalled();
  });
});
