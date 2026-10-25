import { describe, expect, it, vi, type Mock } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { GitHubHttp } from "./github-http.ts";
import { createGitHubRepositoryApi } from "./github-repository-api.ts";

const credential = secret("ghs_token");

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/12";

const pullRequestNode = {
  id: "PR_node12",
  number: 12,
  headRefOid: "head12",
  state: "OPEN",
  isDraft: false,
  mergeStateStatus: "CLEAN",
};

const replying = (reply: unknown) => ({
  requestJson: vi.fn<GitHubHttp["requestJson"]>().mockResolvedValueOnce(succeed({ data: reply })),
});

const replyingTwice = (firstReply: unknown, secondReply: unknown) => ({
  requestJson: vi
    .fn<GitHubHttp["requestJson"]>()
    .mockResolvedValueOnce(succeed({ data: firstReply }))
    .mockResolvedValueOnce(succeed({ data: secondReply })),
});

type RecordingHttp = { readonly requestJson: Mock<GitHubHttp["requestJson"]> };

const lastRequest = (http: RecordingHttp) => http.requestJson.mock.lastCall?.[0];

describe("createGitHubRepositoryApi", () => {
  it("reads a pull request snapshot by number", async () => {
    const http = replying({ repository: { pullRequest: pullRequestNode } });

    const snapshot = await createGitHubRepositoryApi({
      http,
      credential,
      repository,
    }).readPullRequest({
      pullNumber: 12,
    });

    expect(snapshot).toEqual(
      succeed({
        pullNumber: 12,
        nodeId: "PR_node12",
        headSha: "head12",
        lifecycle: "open",
        readiness: "ready-for-review",
        mergeability: "clean",
      }),
    );
    expect(lastRequest(http)).toMatchObject({
      operation: "read pull request",
      requestBody: { variables: { owner: "HailsTails", name: "minutesarah-shop", number: 12 } },
    });
  });

  it("reports a pull request number that does not exist", async () => {
    const http = replying({ repository: { pullRequest: null } });

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).readPullRequest({
        pullNumber: 99,
      }),
    ).toEqual(
      fail({
        kind: "github-rejected",
        operation: "find pull request",
        status: 404,
        detail: "#99 does not exist in HailsTails/minutesarah-shop",
      }),
    );
  });
});

describe("createGitHubRepositoryApi reviews", () => {
  it("lists reviews in order with the commit each one reviewed", async () => {
    const http = replying({
      repository: {
        pullRequest: {
          reviews: {
            nodes: [
              { state: "CHANGES_REQUESTED", commit: { oid: "head11" } },
              { state: "APPROVED", commit: { oid: "head12" } },
            ],
          },
        },
      },
    });

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).listReviews({
        pullNumber: 12,
      }),
    ).toEqual(
      succeed([
        { stance: "changes-requested", reviewedSha: "head11" },
        { stance: "approved", reviewedSha: "head12" },
      ]),
    );
  });
});

describe("createGitHubRepositoryApi writes", () => {
  it("opens a pull request against the repository it looked up", async () => {
    const http = replyingTwice(
      { repository: { id: "R_shop" } },
      { createPullRequest: { pullRequest: { url: pullRequestUrl } } },
    );

    const opened = await createGitHubRepositoryApi({
      http,
      credential,
      repository,
    }).openPullRequest({
      title: "Add the basket",
      body: "marker\n\nAdds the basket.",
      head: "feature/basket",
      base: "main",
      readiness: "draft",
    });

    expect(opened).toEqual(succeed({ url: pullRequestUrl }));
    expect(lastRequest(http)).toMatchObject({
      requestBody: {
        variables: {
          repositoryId: "R_shop",
          base: "main",
          head: "feature/basket",
          title: "Add the basket",
          body: "marker\n\nAdds the basket.",
          draft: true,
        },
      },
    });
  });
});

describe("createGitHubRepositoryApi conversation", () => {
  it("submits a review bound to the reviewed commit", async () => {
    const http = replying({ addPullRequestReview: { pullRequestReview: { url: pullRequestUrl } } });

    await createGitHubRepositoryApi({ http, credential, repository }).submitReview({
      pullRequestId: "PR_node12",
      event: "request-changes",
      commitSha: "head12",
      body: "Needs a test.",
    });

    expect(lastRequest(http)).toMatchObject({
      requestBody: {
        variables: {
          pullRequestId: "PR_node12",
          event: "REQUEST_CHANGES",
          commitSha: "head12",
          body: "Needs a test.",
        },
      },
    });
  });

  it("comments on the issue or pull request with that number", async () => {
    const http = replyingTwice(
      { repository: { issueOrPullRequest: { id: "PR_node12" } } },
      { addComment: { commentEdge: { node: { url: `${pullRequestUrl}#issuecomment-3` } } } },
    );

    const commented = await createGitHubRepositoryApi({
      http,
      credential,
      repository,
    }).commentOnIssue({
      issueNumber: 12,
      body: "Rebased.",
    });

    expect(commented).toEqual(succeed({ url: `${pullRequestUrl}#issuecomment-3` }));
    expect(lastRequest(http)).toMatchObject({
      requestBody: { variables: { subjectId: "PR_node12", body: "Rebased." } },
    });
  });
});

describe("createGitHubRepositoryApi landing", () => {
  it("squash-merges only if GitHub still sees the expected head", async () => {
    const http = replying({
      mergePullRequest: { pullRequest: { mergeCommit: { oid: "merge12" } } },
    });

    const merged = await createGitHubRepositoryApi({ http, credential, repository }).squashMerge({
      pullRequestId: "PR_node12",
      expectedHeadSha: "head12",
    });

    expect(merged).toEqual(succeed({ mergeSha: "merge12" }));
    expect(lastRequest(http)).toMatchObject({
      requestBody: { variables: { pullRequestId: "PR_node12", expectedHeadSha: "head12" } },
    });
  });

  it("closes a pull request by node id", async () => {
    const http = replying({ closePullRequest: { pullRequest: { url: pullRequestUrl } } });

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).closePullRequest({
        pullRequestId: "PR_node12",
      }),
    ).toEqual(succeed({ url: pullRequestUrl }));
  });

  it("reports the readiness GitHub settled on", async () => {
    const http = replying({ readinessChange: { pullRequest: { isDraft: false } } });

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).changeReadiness({
        pullRequestId: "PR_node12",
        readiness: "ready-for-review",
      }),
    ).toEqual(succeed("ready-for-review"));
    expect(JSON.stringify(lastRequest(http)?.requestBody)).toContain(
      "markPullRequestReadyForReview",
    );
  });
});
