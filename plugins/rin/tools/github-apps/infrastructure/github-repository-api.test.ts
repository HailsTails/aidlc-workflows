import { describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { GitHubHttp, GitHubHttpRequest } from "./github-http.ts";
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
        mergeState: "clean",
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

const issueUrl = "https://github.com/HailsTails/minutesarah-shop/issues/429";

const repositoryLabels: Readonly<Record<string, string>> = {
  bug: "LA_bug",
  "stage:triage": "LA_triage",
  "stage:build": "LA_build",
};

const requestPayloadSchema = z.object({
  variables: z.object({ labelName: z.string().optional() }).loose(),
});

const issueReplies: Readonly<Record<string, (labelName: string | undefined) => unknown>> = {
  "read repository": () => ({ repository: { id: "R_shop" } }),
  "find label": (labelName) => ({
    repository: {
      label:
        labelName !== undefined && Object.hasOwn(repositoryLabels, labelName)
          ? { id: repositoryLabels[labelName] }
          : null,
    },
  }),
  "open issue": () => ({ createIssue: { issue: { url: issueUrl } } }),
  "find issue": () => ({ repository: { issue: { id: "I_node429", url: issueUrl } } }),
  "revise issue": () => ({ updateIssue: { issue: { url: issueUrl } } }),
  "add labels": () => ({ addLabelsToLabelable: { clientMutationId: null } }),
  "remove labels": () => ({ removeLabelsFromLabelable: { clientMutationId: null } }),
};

const labelVariable = (request: GitHubHttpRequest): string | undefined =>
  requestPayloadSchema.parse(request.requestBody).variables.labelName;

const answeringIssueRequests = () => ({
  requestJson: vi.fn<GitHubHttp["requestJson"]>().mockImplementation((request) => {
    const reply = issueReplies[request.operation];
    return Promise.resolve(succeed({ data: reply?.(labelVariable(request)) }));
  }),
});

const requestsFor = (http: RecordingHttp, operation: string) =>
  http.requestJson.mock.calls
    .map(([request]) => request)
    .filter((request) => request.operation === operation);

describe("createGitHubRepositoryApi issues", () => {
  it("opens an issue in the repository with the ids of its labels", async () => {
    const http = answeringIssueRequests();

    const opened = await createGitHubRepositoryApi({ http, credential, repository }).openIssue({
      title: "Basket loses items",
      body: "marker\n\nSteps.",
      labels: ["bug", "stage:triage"],
    });

    expect(opened).toEqual(succeed({ url: issueUrl }));
    expect(requestsFor(http, "open issue")[0]).toMatchObject({
      requestBody: {
        variables: {
          repositoryId: "R_shop",
          title: "Basket loses items",
          body: "marker\n\nSteps.",
          labelIds: ["LA_bug", "LA_triage"],
        },
      },
    });
  });

  it("refuses to open an issue with a label the repository does not have", async () => {
    const http = answeringIssueRequests();

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).openIssue({
        title: "Basket loses items",
        body: "Steps.",
        labels: ["stage:unknown"],
      }),
    ).toEqual(
      fail({
        kind: "github-rejected",
        operation: "find label",
        status: 404,
        detail: 'label "stage:unknown" does not exist in HailsTails/minutesarah-shop',
      }),
    );
    expect(requestsFor(http, "open issue")).toEqual([]);
  });

  it("moves labels on an issue without rewriting its fields", async () => {
    const http = answeringIssueRequests();

    const revised = await createGitHubRepositoryApi({ http, credential, repository }).reviseIssue({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      state: undefined,
      labels: { add: ["stage:build"], remove: ["stage:triage"] },
    });

    expect(revised).toEqual(succeed({ url: issueUrl }));
    expect(requestsFor(http, "revise issue")).toEqual([]);
    expect(requestsFor(http, "add labels")[0]).toMatchObject({
      requestBody: { variables: { labelableId: "I_node429", labelIds: ["LA_build"] } },
    });
    expect(requestsFor(http, "remove labels")[0]).toMatchObject({
      requestBody: { variables: { labelableId: "I_node429", labelIds: ["LA_triage"] } },
    });
  });

  it("treats removing a label the repository does not have as already done", async () => {
    const http = answeringIssueRequests();

    const revised = await createGitHubRepositoryApi({ http, credential, repository }).reviseIssue({
      issueNumber: 429,
      title: undefined,
      body: undefined,
      state: undefined,
      labels: { add: [], remove: ["stage:unknown"] },
    });

    expect(revised).toEqual(succeed({ url: issueUrl }));
    expect(requestsFor(http, "remove labels")).toEqual([]);
  });

  it("closes and retitles an issue in one update", async () => {
    const http = answeringIssueRequests();

    await createGitHubRepositoryApi({ http, credential, repository }).reviseIssue({
      issueNumber: 429,
      title: "Basket keeps its items",
      body: undefined,
      state: "closed",
      labels: { add: [], remove: [] },
    });

    expect(requestsFor(http, "revise issue")[0]).toMatchObject({
      requestBody: {
        variables: { issueId: "I_node429", title: "Basket keeps its items", state: "CLOSED" },
      },
    });
    expect(requestsFor(http, "add labels")).toEqual([]);
  });

  it("reports an issue number that does not exist", async () => {
    const http = replying({ repository: { issue: null } });

    expect(
      await createGitHubRepositoryApi({ http, credential, repository }).reviseIssue({
        issueNumber: 999,
        title: "Gone",
        body: undefined,
        state: undefined,
        labels: { add: [], remove: [] },
      }),
    ).toEqual(
      fail({
        kind: "github-rejected",
        operation: "find issue",
        status: 404,
        detail: "#999 does not exist in HailsTails/minutesarah-shop",
      }),
    );
  });
});
