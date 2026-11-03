import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { revisePullRequest } from "./revise-pull-request.ts";

const pullRequest: PullRequestSnapshot = {
  pullNumber: 5,
  nodeId: "PR_node5",
  headSha: "head5",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/5";

const noLabelChange = { add: [], remove: [] };

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi
    .fn<GitHubRepositoryPort["revisePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl, missingLabels: [] })),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
  openIssue: vi.fn(),
  reviseIssue: vi.fn(),
});

const fakeGitHubCli = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi
    .fn<GitHubCliPort["revisePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  commentOnIssue: vi.fn(),
  openIssue: vi.fn(),
  reviseIssue: vi.fn(),
});

const unchangedRequest = {
  role: "author",
  pullNumber: 5,
  title: undefined,
  authoredBody: undefined,
  labels: noLabelChange,
  attachments: [],
  session: undefined,
} as const;

describe("revisePullRequest", () => {
  it("replaces the body with an attributed one, sessioned by the pull number", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await revisePullRequest({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
      authoredBody: "Now with totals.",
    });

    expect(revised).toEqual(succeed({ url: pullRequestUrl, missingLabels: [] }));
    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: undefined,
      body: "<!-- rin-bot: role=author session=5 -->\n\nNow with totals.",
      labels: noLabelChange,
    });
  });

  it("retitles without touching the body", async () => {
    const repositoryApi = fakeRepositoryApi();

    await revisePullRequest({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
      title: "Add basket totals",
    });

    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: "Add basket totals",
      body: undefined,
      labels: noLabelChange,
    });
  });

  it("relabels without touching the title or body", async () => {
    const repositoryApi = fakeRepositoryApi();

    await revisePullRequest({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
      labels: { add: ["stage:review"], remove: ["stage:build"] },
    });

    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: undefined,
      body: undefined,
      labels: { add: ["stage:review"], remove: ["stage:build"] },
    });
  });

  it("refuses a revision that changes nothing", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await revisePullRequest({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
    });

    expect(revised).toEqual(fail({ kind: "nothing-to-revise", pullNumber: 5 }));
    expect(repositoryApi.readPullRequest).not.toHaveBeenCalled();
  });

  it("hands a revision with attachments to gh without reading the pull request", async () => {
    const repositoryApi = fakeRepositoryApi();
    const githubCli = fakeGitHubCli();

    const revised = await revisePullRequest({
      ...unchangedRequest,
      repositoryApi,
      githubCli,
      attachments: ["./after.png"],
    });

    expect(revised).toEqual(succeed({ url: pullRequestUrl, missingLabels: [] }));
    expect(githubCli.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullNumber: 5,
      title: undefined,
      body: undefined,
      labels: noLabelChange,
      attachments: ["./after.png"],
    });
    expect(repositoryApi.readPullRequest).not.toHaveBeenCalled();
  });
});
