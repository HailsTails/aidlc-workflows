import { assert, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import { fail, succeed } from "../../domain/result.ts";
import type { TextFileReader } from "../../infrastructure/text-file-reader.ts";
import type { CommandFlags } from "./command-flags.ts";
import { pullRequestCommands } from "./pull-request-commands.ts";

const pullRequestUrl = "https://github.com/HailsTails/minutesarah-shop/pull/5";

const configuration = {
  repository: { owner: "HailsTails", name: "minutesarah-shop" },
  baseBranch: "main",
  roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
};

const fakeRepositoryApi = () => ({
  openPullRequest: vi
    .fn<GitHubRepositoryPort["openPullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  revisePullRequest: vi
    .fn<GitHubRepositoryPort["revisePullRequest"]>()
    .mockResolvedValue(succeed({ url: pullRequestUrl })),
  readPullRequest: vi.fn<GitHubRepositoryPort["readPullRequest"]>().mockResolvedValue(
    succeed({
      pullNumber: 5,
      nodeId: "PR_node5",
      headSha: "head5",
      lifecycle: "open",
      readiness: "ready-for-review",
      mergeability: "clean",
    }),
  ),
  listReviews: vi.fn(),
  submitReview: vi.fn(),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi
    .fn<GitHubRepositoryPort["changeReadiness"]>()
    .mockResolvedValue(succeed("draft")),
});

const contextWith = ({
  flags,
  repositoryApi,
}: {
  readonly flags: CommandFlags;
  readonly repositoryApi: GitHubRepositoryPort;
}) => ({
  flags,
  configuration,
  role: "author" as const,
  repositoryApi,
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
      readCurrentBranch: vi
        .fn<GitWorktreePort["readCurrentBranch"]>()
        .mockResolvedValue(succeed("feature/basket")),
      readCheckoutKind: vi.fn(),
      configureWorktree: vi.fn(),
    },
    readTextFile: vi.fn<TextFileReader>().mockResolvedValue(succeed("Body from a file.")),
    credentialHelperCommand: "",
  },
});

describe("pr", () => {
  it("opens a draft against the configured base from a body file", async () => {
    const repositoryApi = fakeRepositoryApi();

    const opened = await pullRequestCommands.pr.execute(
      contextWith({
        flags: { title: "Add the basket", "body-file": "body.md", draft: true },
        repositoryApi,
      }),
    );

    expect(opened).toEqual(succeed({ standardOutput: `${pullRequestUrl}\n`, standardError: "" }));
    expect(repositoryApi.openPullRequest).toHaveBeenCalledExactlyOnceWith({
      title: "Add the basket",
      head: "feature/basket",
      base: "main",
      readiness: "draft",
      body: "<!-- rin-bot: role=author session=feature/basket -->\n\nBody from a file.",
    });
  });

  it("refuses to open without a body", async () => {
    expect(
      await pullRequestCommands.pr.execute(
        contextWith({ flags: { title: "Add the basket" }, repositoryApi: fakeRepositoryApi() }),
      ),
    ).toEqual(fail({ kind: "body-missing" }));
  });

  it("refuses an unknown flag", async () => {
    const opened = await pullRequestCommands.pr.execute(
      contextWith({
        flags: { title: "Add the basket", body: "B", reviewer: "x" },
        repositoryApi: fakeRepositoryApi(),
      }),
    );

    assert(opened.kind === "failure" && opened.reason.kind === "flags-invalid");
    expect(opened.reason.issues).toContain("reviewer");
  });
});

describe("pr-edit", () => {
  it("retitles a pull request", async () => {
    const repositoryApi = fakeRepositoryApi();

    const revised = await pullRequestCommands["pr-edit"].execute(
      contextWith({ flags: { pr: "5", title: "Add basket totals" }, repositoryApi }),
    );

    expect(revised).toEqual(
      succeed({ standardOutput: `Revised ${pullRequestUrl}\n`, standardError: "" }),
    );
    expect(repositoryApi.revisePullRequest).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      title: "Add basket totals",
      body: undefined,
    });
  });
});

describe("draft and ready", () => {
  it("converts a pull request to a draft", async () => {
    const repositoryApi = fakeRepositoryApi();

    expect(
      await pullRequestCommands.draft.execute(contextWith({ flags: { pr: "5" }, repositoryApi })),
    ).toEqual(succeed({ standardOutput: "#5 is now draft\n", standardError: "" }));
    expect(repositoryApi.changeReadiness).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      readiness: "draft",
    });
  });

  it("marks a pull request ready for review", async () => {
    const repositoryApi = fakeRepositoryApi();

    await pullRequestCommands.ready.execute(contextWith({ flags: { pr: "5" }, repositoryApi }));

    expect(repositoryApi.changeReadiness).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node5",
      readiness: "ready-for-review",
    });
  });
});
