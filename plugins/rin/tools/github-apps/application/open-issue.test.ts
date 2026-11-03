import { describe, expect, it, vi } from "vitest";
import { succeed } from "../domain/result.ts";
import type { GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { openIssue } from "./open-issue.ts";

const issueUrl = "https://github.com/HailsTails/minutesarah-shop/issues/429";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn(),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
  openIssue: vi
    .fn<GitHubRepositoryPort["openIssue"]>()
    .mockResolvedValue(succeed({ url: issueUrl })),
  reviseIssue: vi.fn(),
});

const fakeGitHubCli = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  commentOnIssue: vi.fn(),
  openIssue: vi.fn<GitHubCliPort["openIssue"]>().mockResolvedValue(succeed({ url: issueUrl })),
  reviseIssue: vi.fn(),
});

describe("openIssue", () => {
  it("opens an attributed issue with its labels", async () => {
    const repositoryApi = fakeRepositoryApi();

    const opened = await openIssue({
      repositoryApi,
      githubCli: fakeGitHubCli(),
      role: "author",
      title: "Basket loses items",
      authoredBody: "Steps to reproduce.",
      labels: ["bug", "stage:triage"],
      attachments: [],
      session: "basket-fix",
    });

    expect(opened).toEqual(succeed({ url: issueUrl }));
    expect(repositoryApi.openIssue).toHaveBeenCalledExactlyOnceWith({
      title: "Basket loses items",
      body: "<!-- rin-bot: role=author session=basket-fix -->\n\nSteps to reproduce.",
      labels: ["bug", "stage:triage"],
    });
  });

  it("marks an issue opened without a session as a new issue", async () => {
    const repositoryApi = fakeRepositoryApi();

    await openIssue({
      repositoryApi,
      githubCli: fakeGitHubCli(),
      role: "author",
      title: "Basket loses items",
      authoredBody: "Steps to reproduce.",
      labels: [],
      attachments: [],
      session: undefined,
    });

    expect(repositoryApi.openIssue).toHaveBeenCalledExactlyOnceWith({
      title: "Basket loses items",
      body: "<!-- rin-bot: role=author session=new-issue -->\n\nSteps to reproduce.",
      labels: [],
    });
  });

  it("hands an issue with attachments to gh", async () => {
    const repositoryApi = fakeRepositoryApi();
    const githubCli = fakeGitHubCli();

    await openIssue({
      repositoryApi,
      githubCli,
      role: "author",
      title: "Basket loses items",
      authoredBody: "![The empty basket](./empty.png)",
      labels: ["bug"],
      attachments: ["./empty.png"],
      session: undefined,
    });

    expect(repositoryApi.openIssue).not.toHaveBeenCalled();
    expect(githubCli.openIssue).toHaveBeenCalledExactlyOnceWith({
      title: "Basket loses items",
      body: "<!-- rin-bot: role=author session=new-issue -->\n\n![The empty basket](./empty.png)",
      labels: ["bug"],
      attachments: ["./empty.png"],
    });
  });
});
