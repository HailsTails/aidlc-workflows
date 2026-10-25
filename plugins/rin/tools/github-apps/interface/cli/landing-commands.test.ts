import { assert, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import { succeed } from "../../domain/result.ts";
import type { CommandFlags } from "./command-flags.ts";
import { landingCommands } from "./landing-commands.ts";

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/8";

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi.fn<GitHubRepositoryPort["readPullRequest"]>().mockResolvedValue(
    succeed({
      pullNumber: 8,
      nodeId: "PR_node8",
      headSha: "head8",
      lifecycle: "open",
      readiness: "ready-for-review",
      mergeability: "not-clean",
    }),
  ),
  listReviews: vi
    .fn<GitHubRepositoryPort["listReviews"]>()
    .mockResolvedValue(succeed([{ stance: "approved", reviewedSha: "head8" }])),
  submitReview: vi.fn(),
  commentOnIssue: vi
    .fn<GitHubRepositoryPort["commentOnIssue"]>()
    .mockResolvedValue(succeed({ url: `${pullRequestUrl}#issuecomment-1` })),
  squashMerge: vi
    .fn<GitHubRepositoryPort["squashMerge"]>()
    .mockResolvedValue(succeed({ mergeSha: "merge8" })),
  closePullRequest: vi
    .fn<GitHubRepositoryPort["closePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  changeReadiness: vi.fn(),
});

const contextWith = ({
  flags,
  repositoryApi,
}: {
  readonly flags: CommandFlags;
  readonly repositoryApi: GitHubRepositoryPort;
}) => ({
  flags,
  role: "author" as const,
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

describe("merge", () => {
  it("squash-merges an approved head and reports the merge commit", async () => {
    const repositoryApi = fakeRepositoryApi();

    expect(
      await landingCommands.merge.execute(contextWith({ flags: { pr: "8" }, repositoryApi })),
    ).toEqual(succeed({ standardOutput: "Squash-merged #8 as merge8\n", standardError: "" }));
    expect(repositoryApi.squashMerge).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node8",
      expectedHeadSha: "head8",
    });
  });

  it("refuses a merge without a pull request number", async () => {
    const merged = await landingCommands.merge.execute(
      contextWith({ flags: {}, repositoryApi: fakeRepositoryApi() }),
    );

    assert(merged.kind === "failure" && merged.reason.kind === "flags-invalid");
    expect(merged.reason.issues).toContain("pr");
  });
});

describe("close", () => {
  it("closes a superseded pull request, giving the reason", async () => {
    const repositoryApi = fakeRepositoryApi();

    expect(
      await landingCommands.close.execute(
        contextWith({ flags: { pr: "8", reason: "replaced by #9" }, repositoryApi }),
      ),
    ).toEqual(
      succeed({ standardOutput: `Closed ${pullRequestUrl} as superseded\n`, standardError: "" }),
    );
    expect(repositoryApi.commentOnIssue).toHaveBeenCalledExactlyOnceWith({
      issueNumber: 8,
      body: "<!-- rin-bot: role=author session=8 -->\n\nsuperseded: replaced by #9",
    });
  });
});
