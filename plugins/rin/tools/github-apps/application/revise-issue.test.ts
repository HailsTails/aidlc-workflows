import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
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
    .mockResolvedValue(succeed({ url: issueUrl })),
});

describe("reviseIssue", () => {
  it("moves the issue's stage labels without touching its text", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await reviseIssue({
      repositoryApi,
      role: "author",
      issueNumber: 429,
      title: undefined,
      authoredBody: undefined,
      state: undefined,
      labels: { add: ["stage:build"], remove: ["stage:triage"] },
      session: undefined,
    });

    expect(revised).toEqual(succeed({ url: issueUrl }));
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
      repositoryApi,
      role: "author",
      issueNumber: 429,
      title: "Basket keeps its items",
      authoredBody: "Fixed in #430.",
      state: "closed",
      labels: noLabelChange,
      session: undefined,
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
      await reviseIssue({
        repositoryApi,
        role: "author",
        issueNumber: 429,
        title: undefined,
        authoredBody: undefined,
        state: undefined,
        labels: noLabelChange,
        session: undefined,
      }),
    ).toEqual(fail({ kind: "issue-unchanged", issueNumber: 429 }));
    expect(repositoryApi.reviseIssue).not.toHaveBeenCalled();
  });
});
