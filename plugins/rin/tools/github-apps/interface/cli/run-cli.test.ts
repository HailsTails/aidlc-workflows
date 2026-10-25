import { describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryPort } from "../../application/github-repository-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import { fail, succeed } from "../../domain/result.ts";
import { secret } from "../../domain/secret.ts";
import type { CliDependencies } from "./cli-command.ts";
import { runCli } from "./run-cli.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const configuration = {
  repository,
  baseBranch: "main",
  roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
};

const reviewerToken = secret("ghs_reviewer");

const pullRequest = {
  pullNumber: 4,
  nodeId: "PR_node4",
  headSha: "head4",
  lifecycle: "open",
  readiness: "ready-for-review",
  mergeability: "clean",
} as const;

const fakeRepositoryApi = () => ({
  openPullRequest: vi.fn(),
  revisePullRequest: vi.fn(),
  readPullRequest: vi
    .fn<GitHubRepositoryPort["readPullRequest"]>()
    .mockResolvedValue(succeed(pullRequest)),
  listReviews: vi.fn<GitHubRepositoryPort["listReviews"]>().mockResolvedValue(succeed([])),
  submitReview: vi
    .fn<GitHubRepositoryPort["submitReview"]>()
    .mockResolvedValue(succeed({ url: "https://github.com/review/1" })),
  commentOnIssue: vi.fn(),
  squashMerge: vi.fn(),
  closePullRequest: vi.fn(),
  changeReadiness: vi.fn(),
});

const fakeDependencies = (repositoryApi: GitHubRepositoryPort) => ({
  terminal: {
    commandArguments: vi.fn(),
    writeOutput: vi.fn(),
    writeError: vi.fn(),
    readInput: vi.fn<() => Promise<string>>().mockResolvedValue(""),
    finish: vi.fn(),
  },
  loadConfiguration: vi
    .fn<CliDependencies["loadConfiguration"]>()
    .mockResolvedValue(succeed(configuration)),
  tokenMinter: {
    mintInstallationToken: vi
      .fn<TokenMinter["mintInstallationToken"]>()
      .mockResolvedValue(succeed(reviewerToken)),
  },
  connectRepository: vi.fn<CliDependencies["connectRepository"]>().mockReturnValue(repositoryApi),
  worktree: {
    readCurrentBranch: vi.fn(),
    readCheckoutKind: vi.fn(),
    configureWorktree: vi.fn(),
  },
  readTextFile: vi.fn(),
  credentialHelperCommand: '!bun "cli-main.ts" git-credential --operation',
});

describe("runCli", () => {
  it("runs a repository command as its role's bot, against the configured repository", async () => {
    const repositoryApi = fakeRepositoryApi();
    const dependencies = fakeDependencies(repositoryApi);

    const exitCode = await runCli({
      dependencies,
      commandArguments: ["review", "--", "--pr", "4", "--event", "approve", "--body", "Ship it."],
    });

    expect(exitCode).toBe(0);
    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "reviewer",
      appSlug: "rin-reviewer",
      repository,
    });
    expect(dependencies.connectRepository).toHaveBeenCalledExactlyOnceWith({
      token: reviewerToken,
      repository,
    });
    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "Reviewed #4 (approve): https://github.com/review/1\n",
    );
  });

  it("refuses a merge without an approval and says why", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());

    const exitCode = await runCli({ dependencies, commandArguments: ["merge", "--pr", "4"] });

    expect(exitCode).toBe(1);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      "#4 cannot merge: no review has given a verdict; merging requires an approval.\n",
    );
  });
});

describe("runCli as git's credential helper", () => {
  it("tells git to stop asking when the credential helper cannot serve it", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());
    dependencies.terminal.readInput.mockResolvedValue("protocol=https\nhost=example.com\n");

    const exitCode = await runCli({
      dependencies,
      commandArguments: ["git-credential", "--operation", "get"],
    });

    expect(exitCode).toBe(1);
    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith("quit=true\n");
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("answers git with the author token for the configured repository", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());
    dependencies.terminal.readInput.mockResolvedValue(
      "protocol=https\nhost=github.com\npath=HailsTails/minutesarah-shop.git\n",
    );

    await runCli({ dependencies, commandArguments: ["git-credential", "--operation", "get"] });

    expect(dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      appSlug: "rin-author",
      repository,
    });
    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "username=x-access-token\npassword=ghs_reviewer\n",
    );
  });

  it("stays silent for credential operations other than get", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());

    expect(
      await runCli({ dependencies, commandArguments: ["git-credential", "--operation", "store"] }),
    ).toBe(0);
    expect(dependencies.terminal.readInput).not.toHaveBeenCalled();
  });
});

describe("runCli local and refused invocations", () => {
  it("prints the provenance marker without touching GitHub", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());

    await runCli({
      dependencies,
      commandArguments: ["marker", "--role", "author", "--session", "s-1"],
    });

    expect(dependencies.terminal.writeOutput).toHaveBeenCalledExactlyOnceWith(
      "<!-- rin-bot: role=author session=s-1 -->\n",
    );
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("reports an unusable configuration before minting anything", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());
    dependencies.loadConfiguration.mockResolvedValue(
      fail({ kind: "configuration-unreadable", location: "file:///github-identity.json" }),
    );

    expect(await runCli({ dependencies, commandArguments: ["merge", "--pr", "4"] })).toBe(1);
    expect(dependencies.tokenMinter.mintInstallationToken).not.toHaveBeenCalled();
  });

  it("refuses repeated flags", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());

    expect(
      await runCli({ dependencies, commandArguments: ["merge", "--pr", "4", "--pr", "5"] }),
    ).toBe(1);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      "--pr was given more than once.\n",
    );
  });

  it("prints usage for an unknown command", async () => {
    const dependencies = fakeDependencies(fakeRepositoryApi());

    expect(await runCli({ dependencies, commandArguments: ["deploy"] })).toBe(2);
    expect(dependencies.terminal.writeError).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^Unknown command "deploy"\.\nUsage: /),
    );
  });
});
