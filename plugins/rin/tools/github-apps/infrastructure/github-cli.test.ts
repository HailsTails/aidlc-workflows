import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { createGitHubCli } from "./github-cli.ts";
import type { ProcessRunner } from "./process-runner.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const environment = { GH_TOKEN: "ghs_bot", GH_PROMPT_DISABLED: "1" };

const printed = (standardOutput: string) => succeed({ standardOutput, standardError: "", exitCode: 0 });

const cliWith = (runProcess: ProcessRunner) =>
  createGitHubCli({ runProcess, credential: secret("ghs_bot"), repository });

const pullRequestView = JSON.stringify({
  id: "PR_node4",
  number: 4,
  headRefOid: "head4",
  state: "OPEN",
  isDraft: false,
  mergeStateStatus: "CLEAN",
  reviews: [{ state: "APPROVED", commit: { oid: "head4" }, author: { login: "rin-reviewer" } }],
});

describe("createGitHubCli run", () => {
  it("runs gh with the bot token, prompts off, pinned to the configured repository", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(printed(""));

    await cliWith(runProcess).run({ ghArguments: ["pr", "create", "--body-file", "-"], standardInput: "x" });

    expect(runProcess).toHaveBeenCalledExactlyOnceWith({
      command: "gh",
      commandArguments: ["pr", "create", "--body-file", "-", "--repo", "HailsTails/minutesarah-shop"],
      environment,
      standardInput: "x",
    });
  });

  it("reports gh missing from PATH", async () => {
    const runProcess = vi
      .fn<ProcessRunner>()
      .mockResolvedValue(fail({ kind: "process-unavailable", command: "gh", detail: "spawn gh ENOENT" }));

    expect(await cliWith(runProcess).run({ ghArguments: ["pr", "ready"], standardInput: undefined })).toEqual(
      fail({ kind: "gh-unavailable", detail: "spawn gh ENOENT" }),
    );
  });
});

describe("createGitHubCli readPullRequest", () => {
  it("asks gh pr view for the fields the guards read", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(printed(pullRequestView));

    await cliWith(runProcess).readPullRequest(4);

    expect(runProcess).toHaveBeenCalledExactlyOnceWith({
      command: "gh",
      commandArguments: [
        "pr",
        "view",
        "4",
        "--json",
        "id,number,headRefOid,state,isDraft,mergeStateStatus,reviews",
        "--repo",
        "HailsTails/minutesarah-shop",
      ],
      environment,
      standardInput: undefined,
    });
  });

  it("maps what gh printed to the pull request and its reviews", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(printed(pullRequestView));

    expect(await cliWith(runProcess).readPullRequest(4)).toEqual(
      succeed({
        pullRequest: {
          pullNumber: 4,
          nodeId: "PR_node4",
          headSha: "head4",
          lifecycle: "open",
          readiness: "ready-for-review",
          mergeState: "clean",
        },
        reviews: [{ stance: "approved", reviewedSha: "head4" }],
      }),
    );
  });

  it("reports what gh said when the read fails", async () => {
    const runProcess = vi
      .fn<ProcessRunner>()
      .mockResolvedValue(succeed({ standardOutput: "", standardError: "no such pull request\n", exitCode: 1 }));

    expect(await cliWith(runProcess).readPullRequest(4)).toEqual(
      fail({ kind: "gh-read-failed", operation: "read pull request", detail: "no such pull request" }),
    );
  });

  it("reports output that is not JSON", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(printed("not json"));

    expect(await cliWith(runProcess).readPullRequest(4)).toEqual(
      fail({
        kind: "gh-read-failed",
        operation: "read pull request",
        detail: "gh printed something other than JSON",
      }),
    );
  });
});

describe("createGitHubCli submitReview", () => {
  it("binds the review to the commit through gh api graphql, with the body on standard input", async () => {
    const runProcess = vi.fn<ProcessRunner>().mockResolvedValue(printed(""));

    await cliWith(runProcess).submitReview({
      pullRequestId: "PR_node4",
      commitSha: "head4",
      event: "request-changes",
      body: "Fix it.",
    });

    expect(runProcess).toHaveBeenCalledExactlyOnceWith({
      command: "gh",
      commandArguments: [
        "api",
        "graphql",
        "-f",
        `query=mutation SubmitReview($pullRequestId: ID!, $event: PullRequestReviewEvent!, $commitOID: GitObjectID!, $body: String!) {
  addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, commitOID: $commitOID, body: $body }) { pullRequestReview { url } }
}`,
        "-f",
        "pullRequestId=PR_node4",
        "-f",
        "event=REQUEST_CHANGES",
        "-f",
        "commitOID=head4",
        "-F",
        "body=@-",
        "--jq",
        ".data.addPullRequestReview.pullRequestReview.url",
      ],
      environment,
      standardInput: "Fix it.",
    });
  });
});
