import { assert, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import { succeed } from "../../domain/result.ts";
import type { CommandFlags } from "./command-flags.ts";
import { conversationCommands } from "./conversation-commands.ts";

const reviewUrl = "https://github.com/HailsTails/minutesarah-shop/pull/6#pullrequestreview-1";

const reviewedSha = "0123456789abcdef0123456789abcdef01234567";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn<GitHubRepositoryPort["readPullRequest"]>().mockResolvedValue(
    succeed({
      pullNumber: 6,
      nodeId: "PR_node6",
      headSha: reviewedSha,
      lifecycle: "open",
      readiness: "ready-for-review",
      mergeState: "clean",
    }),
  ),
  listReviews: vi.fn(),
  submitReview: vi
    .fn<GitHubRepositoryPort["submitReview"]>()
    .mockResolvedValue(succeed({ url: reviewUrl })),
  commentOnIssue: vi
    .fn<GitHubRepositoryPort["commentOnIssue"]>()
    .mockResolvedValue(succeed({ url: `${reviewUrl}-comment` })),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

const contextWith = ({
  flags,
  repositoryApi,
  role,
}: {
  readonly flags: CommandFlags;
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: "author" | "reviewer";
}) => ({
  flags,
  role,
  repositoryApi,
  configuration: {
    repository: { owner: "HailsTails", name: "minutesarah-shop" },
    baseBranch: "main",
    roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
  },
  dependencies: {
    terminal: {
      commandArguments: vi.fn(),
      writeOutput: vi.fn(),
      writeError: vi.fn(),
      readInput: vi.fn(),
      finish: vi.fn(),
    },
    loadConfiguration: vi.fn(),
    tokenMinter: { mintInstallationToken: vi.fn() },
    connectRepository: vi.fn(),
    worktree: {
      readCurrentBranch: vi.fn(),
      readCheckoutKind: vi.fn(),
      readPushRemote: vi.fn(),
      configureWorktree: vi.fn(),
    },
    readBodyFile: vi.fn(),
    credentialHelperCommand: "",
  },
});

describe("review", () => {
  it("requests changes on the commit the reviewer read", async () => {
    const repositoryApi = fakeRepositoryApi();

    const reviewed = await conversationCommands.review.execute(
      contextWith({
        flags: {
          pr: "6",
          event: "request-changes",
          "commit-sha": reviewedSha,
          body: "Add a test.",
        },
        repositoryApi,
        role: "reviewer",
      }),
    );

    expect(reviewed).toEqual(
      succeed({
        standardOutput: `Reviewed #6 (request-changes): ${reviewUrl}\n`,
        standardError: "",
      }),
    );
    expect(repositoryApi.submitReview).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node6",
      event: "request-changes",
      commitSha: reviewedSha,
      body: "<!-- rin-bot: role=reviewer session=6 -->\n\nAdd a test.",
    });
  });

  it("refuses an event GitHub reviews do not have", async () => {
    const reviewed = await conversationCommands.review.execute(
      contextWith({
        flags: { pr: "6", event: "merge", body: "Ship it." },
        repositoryApi: fakeRepositoryApi(),
        role: "reviewer",
      }),
    );

    assert(reviewed.kind === "failure" && reviewed.reason.kind === "flags-invalid");
    expect(reviewed.reason.issues).toContain("event");
  });
});

describe("comment", () => {
  it("comments on the target as the author", async () => {
    const repositoryApi = fakeRepositoryApi();

    const commented = await conversationCommands.comment.execute(
      contextWith({ flags: { target: "6", body: "Rebased." }, repositoryApi, role: "author" }),
    );

    expect(commented).toEqual(
      succeed({ standardOutput: `${reviewUrl}-comment\n`, standardError: "" }),
    );
    expect(repositoryApi.commentOnIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 6,
      body: "<!-- rin-bot: role=author session=6 -->\n\nRebased.",
    });
  });
});
