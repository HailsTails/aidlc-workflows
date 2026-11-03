import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";
import { reviseIssue } from "./revise-issue.ts";

const issueUrl = "https://github.com/HailsTails/minutesarah-shop/issues/429";

const noLabelChange = { add: [], remove: [] };

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
  openIssue: vi.fn(),
  reviseIssue: vi
    .fn<GitHubRepositoryPort["reviseIssue"]>()
    .mockResolvedValue(succeed({ url: issueUrl, missingLabels: [] })),
});

const fakeGitHubCli = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  commentOnIssue: vi.fn(),
  openIssue: vi.fn(),
  reviseIssue: vi.fn<GitHubCliPort["reviseIssue"]>().mockResolvedValue(succeed({ url: issueUrl })),
});

const unchangedRequest = {
  role: "author",
  issueNumber: 429,
  title: undefined,
  authoredBody: undefined,
  state: undefined,
  labels: noLabelChange,
  attachments: [],
  session: undefined,
} as const;

describe("reviseIssue", () => {
  it("moves the issue's stage labels without touching its text", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await reviseIssue({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
      labels: { add: ["stage:build"], remove: ["stage:triage"] },
    });

    expect(revised).toEqual(succeed({ url: issueUrl, missingLabels: [] }));
    expect(repositoryApi.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      state: undefined,
      labels: { add: ["stage:build"], remove: ["stage:triage"] },
    });
  });

  it("attributes a rewritten body, sessioned by the issue number by default", async () => {
    const repositoryApi = fakeRepositoryApi();

    await reviseIssue({
      ...unchangedRequest,
      repositoryApi,
      githubCli: fakeGitHubCli(),
      title: "Basket keeps its items",
      authoredBody: "Fixed in #430.",
      state: "closed",
    });

    expect(repositoryApi.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: "Basket keeps its items",
      body: "<!-- rin-bot: role=author session=429 -->\n\nFixed in #430.",
      state: "closed",
      labels: noLabelChange,
    });
  });

  it("refuses a revision that changes nothing", async () => {
    const repositoryApi = fakeRepositoryApi();

    expect(
      await reviseIssue({ ...unchangedRequest, repositoryApi, githubCli: fakeGitHubCli() }),
    ).toEqual(fail({ kind: "issue-unchanged", issueNumber: 429 }));
    expect(repositoryApi.reviseIssue).not.toHaveBeenCalled();
  });
});

describe("reviseIssue with attachments", () => {
  it("hands the edit to gh and changes nothing else", async () => {
    const repositoryApi = fakeRepositoryApi();
    const githubCli = fakeGitHubCli();

    const revised = await reviseIssue({
      ...unchangedRequest,
      repositoryApi,
      githubCli,
      labels: { add: ["bug"], remove: [] },
      attachments: ["./repro.mp4"],
    });

    expect(revised).toEqual(succeed({ url: issueUrl, missingLabels: [] }));
    expect(githubCli.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      labels: { add: ["bug"], remove: [] },
      attachments: ["./repro.mp4"],
    });
    expect(repositoryApi.reviseIssue).not.toHaveBeenCalled();
  });

  it("changes the state after gh has attached the files", async () => {
    const repositoryApi = fakeRepositoryApi();
    const githubCli = fakeGitHubCli();

    await reviseIssue({
      ...unchangedRequest,
      repositoryApi,
      githubCli,
      authoredBody: "Fixed; see the recording.",
      state: "closed",
      attachments: ["./fixed.mp4"],
    });

    expect(githubCli.reviseIssue).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        body: "<!-- rin-bot: role=author session=429 -->\n\nFixed; see the recording.",
      }),
    );
    expect(repositoryApi.reviseIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      state: "closed",
      labels: noLabelChange,
    });
  });

  it("leaves the state alone when gh fails", async () => {
    const repositoryApi = fakeRepositoryApi();
    const githubCli = fakeGitHubCli();
    const ghFailure = fail({
      kind: "gh-command-failed",
      command: "gh issue edit 429",
      detail: "could not upload ./fixed.mp4",
      publishedUrl: undefined,
    } as const);
    githubCli.reviseIssue.mockResolvedValue(ghFailure);

    const revised = await reviseIssue({
      ...unchangedRequest,
      repositoryApi,
      githubCli,
      state: "closed",
      attachments: ["./fixed.mp4"],
    });

    expect(revised).toEqual(ghFailure);
    expect(repositoryApi.reviseIssue).not.toHaveBeenCalled();
  });
});
