import { describe, expect, it, vi } from "vitest";
import type { PullRequestSnapshot } from "../domain/pull-request.ts";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { StorePlacementCheck } from "./credential-store-boundary.ts";
import type { GitHubCliPort } from "./github-cli-port.ts";
import type { GitWorktreePort } from "./git-worktree-port.ts";
import type { TokenMinter } from "./mint-installation-token.ts";
import type { BodyFileReader } from "./read-body-file.ts";
import { runGhAsBot, type GhAsBotDependencies } from "./run-gh-as-bot.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const configuration = {
  repository,
  baseBranch: "main",
  roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
};

const token = secret("ghs_bot");

const ghPrinted = succeed({ standardOutput: "https://github.com/pull/4\n", standardError: "", exitCode: 0 });

const openPullRequest: PullRequestSnapshot = {
  pullNumber: 4,
  nodeId: "PR_node4",
  headSha: "head4",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeState: "clean",
};

const fakeGh = () => ({
  run: vi.fn<GitHubCliPort["run"]>().mockResolvedValue(ghPrinted),
  readPullRequest: vi
    .fn<GitHubCliPort["readPullRequest"]>()
    .mockResolvedValue(succeed({ pullRequest: openPullRequest, reviews: [] })),
  submitReview: vi.fn<GitHubCliPort["submitReview"]>().mockResolvedValue(ghPrinted),
});

const fakeDependencies = () => {
  const gh = fakeGh();
  return {
    gh,
    dependencies: {
      tokenMinter: {
        mintInstallationToken: vi
          .fn<TokenMinter["mintInstallationToken"]>()
          .mockResolvedValue(succeed(token)),
      },
      connectGitHubCli: vi.fn<GhAsBotDependencies["connectGitHubCli"]>().mockReturnValue(gh),
      worktree: {
        readCurrentBranch: vi
          .fn<GitWorktreePort["readCurrentBranch"]>()
          .mockResolvedValue(succeed("feature/basket")),
        readCheckoutKind: vi.fn<GitWorktreePort["readCheckoutKind"]>(),
        readPushRemote: vi.fn<GitWorktreePort["readPushRemote"]>(),
        configureWorktree: vi.fn<GitWorktreePort["configureWorktree"]>(),
      },
      readBodyFile: vi.fn<BodyFileReader>().mockResolvedValue(succeed("From the file.")),
      readStandardInput: vi.fn<() => Promise<string>>().mockResolvedValue("From stdin."),
      placeInStore: vi
        .fn<StorePlacementCheck>()
        .mockResolvedValue({ kind: "outside-store", canonicalPath: "H:/shop/a.png" }),
    },
  };
};

const run = (commandArguments: readonly string[], dependencies: GhAsBotDependencies) =>
  runGhAsBot({ commandArguments, configuration, dependencies });

describe("runGhAsBot identity", () => {
  it("mints the author token the route asks for", async () => {
    const { dependencies } = fakeDependencies();

    await run(["issue", "create", "-t", "Bug", "-b", "Steps."], dependencies);

    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      appSlug: "rin-author",
      repository,
      permissions: { issues: "write" },
    });
  });

  it("connects gh with the minted token to the configured repository", async () => {
    const { dependencies } = fakeDependencies();

    await run(["pr", "ready", "4"], dependencies);

    expect(dependencies.connectGitHubCli).toHaveBeenCalledExactlyOnceWith({ token, repository });
  });
});

describe("runGhAsBot stamping", () => {
  it("stamps the body and feeds it through standard input, named for the current branch", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "create", "--title", "Basket", "--body", "Adds it."], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "create", "--title", "Basket", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=feature/basket -->\n\nAdds it.",
    });
  });

  it("names the session after the target it writes to", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["issue", "comment", "429", "-F", "note.md"], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["issue", "comment", "429", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=429 -->\n\nFrom the file.",
    });
  });

  it("reads a body file through the guarded reader", async () => {
    const { dependencies } = fakeDependencies();

    await run(["issue", "comment", "429", "-F", "note.md"], dependencies);

    expect(dependencies.readBodyFile).toHaveBeenCalledExactlyOnceWith("note.md");
  });

  it("prefers an explicit --session", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "comment", "4", "--session", "pr-6", "-b", "Hi."], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "comment", "4", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=pr-6 -->\n\nHi.",
    });
  });

  it("names a new issue's session new-issue and reads its body from standard input", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["issue", "create", "-t", "Bug", "--body-file", "-"], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["issue", "create", "-t", "Bug", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=new-issue -->\n\nFrom stdin.",
    });
  });

  it("leaves an edit without a body untouched", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "edit", "4", "--add-label", "bug"], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "edit", "4", "--add-label", "bug"],
      standardInput: undefined,
    });
  });

  it("passes a merge commit body through unstamped", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "merge", "4", "--squash", "-b", "Squashed."], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "merge", "4", "--squash", "--body-file", "-"],
      standardInput: "Squashed.",
    });
  });

  it("lets an attachment stand in for the text, still stamped", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "comment", "4", "--attach", "a.png"], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "comment", "4", "--attach", "a.png", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=4 -->\n\n",
    });
  });
});

describe("runGhAsBot refusals", () => {
  it("refuses a comment with neither text nor attachments", async () => {
    const { dependencies } = fakeDependencies();

    expect(await run(["pr", "comment", "4"], dependencies)).toEqual(
      fail({ kind: "gh-body-missing", verb: "pr comment" }),
    );
  });

  it("refuses an attachment inside the credential store", async () => {
    const { dependencies } = fakeDependencies();
    dependencies.placeInStore.mockResolvedValue({ kind: "inside-store" });

    expect(await run(["issue", "comment", "9", "-b", "x", "--attach", "keys/a.pem"], dependencies)).toEqual(
      fail({ kind: "attachment-refused", attachment: "keys/a.pem" }),
    );
  });

  it("mints nothing for a refused attachment", async () => {
    const { dependencies } = fakeDependencies();
    dependencies.placeInStore.mockResolvedValue({ kind: "inside-store" });

    await run(["issue", "comment", "9", "-b", "x", "--attach", "keys/a.pem"], dependencies);

    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("refuses inline text carrying a private key", async () => {
    const { dependencies } = fakeDependencies();

    expect(await run(["issue", "comment", "9", "-b", "-----BEGIN RSA PRIVATE KEY-----"], dependencies)).toEqual(
      fail({ kind: "inline-body-refused", reason: "contains-private-key" }),
    );
  });
});

describe("runGhAsBot close guard", () => {
  it("reads the pull request it is asked to close", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "close", "4"], dependencies);

    expect(gh.readPullRequest).toHaveBeenCalledExactlyOnceWith(4);
  });

  it("closes with a stamped closing comment when nothing approved it", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "close", "4", "-c", "Superseded."], dependencies);

    expect(gh.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["pr", "close", "4", "--comment", "<!-- rin-bot: role=author session=4 -->\n\nSuperseded."],
      standardInput: undefined,
    });
  });

  it("refuses to close an approved, mergeable pull request", async () => {
    const { gh, dependencies } = fakeDependencies();
    gh.readPullRequest.mockResolvedValue(
      succeed({ pullRequest: openPullRequest, reviews: [{ stance: "approved", reviewedSha: "head4" }] }),
    );

    expect(await run(["pr", "close", "4"], dependencies)).toEqual(
      fail({ kind: "approved-and-mergeable", pullNumber: 4 }),
    );
  });

  it("needs the pull request number right after the verb", async () => {
    const { dependencies } = fakeDependencies();

    expect(await run(["pr", "close", "feature/basket"], dependencies)).toEqual(
      fail({ kind: "gh-target-required", verb: "pr close" }),
    );
  });
});

describe("runGhAsBot review binding", () => {
  it("mints the reviewer token for a review", async () => {
    const { dependencies } = fakeDependencies();

    await run(["pr", "review", "4", "--approve"], dependencies);

    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "reviewer",
      appSlug: "rin-reviewer",
      repository,
      permissions: undefined,
    });
  });

  it("submits the review bound to the head it read, with the body stamped", async () => {
    const { gh, dependencies } = fakeDependencies();

    await run(["pr", "review", "4", "--approve", "-b", "Ship it."], dependencies);

    expect(gh.submitReview).toHaveBeenCalledExactlyOnceWith({
      pullRequestId: "PR_node4",
      commitSha: "head4",
      event: "approve",
      body: "<!-- rin-bot: role=reviewer session=4 -->\n\nShip it.",
    });
  });

  it("refuses a review of a commit that is no longer the head", async () => {
    const { dependencies } = fakeDependencies();

    expect(await run(["pr", "review", "4", "--approve", "--commit-sha", "old3"], dependencies)).toEqual(
      fail({ kind: "reviewed-head-moved", pullNumber: 4, reviewedSha: "old3", headSha: "head4" }),
    );
  });
});
