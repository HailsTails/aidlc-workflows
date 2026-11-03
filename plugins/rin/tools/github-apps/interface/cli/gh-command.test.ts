import { describe, expect, it, vi } from "vitest";
import type { StorePlacementCheck } from "../../application/credential-store-boundary.ts";
import type { GitHubCliPort } from "../../application/github-cli-port.ts";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import type { BodyFileReader } from "../../application/read-body-file.ts";
import { succeed } from "../../domain/result.ts";
import { secret } from "../../domain/secret.ts";
import type { CliDependencies } from "./cli-command.ts";
import { ghCommand } from "./gh-command.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const configuration = {
  repository,
  baseBranch: "main",
  roles: { author: { appSlug: "rin-author" }, reviewer: { appSlug: "rin-reviewer" } },
};

describe("ghCommand", () => {
  it("reads --body-file - from the terminal's standard input", async () => {
    const githubCli = {
      run: vi
        .fn<GitHubCliPort["run"]>()
        .mockResolvedValue(succeed({ standardOutput: "", standardError: "", exitCode: 0 })),
      readPullRequest: vi.fn<GitHubCliPort["readPullRequest"]>(),
      submitReview: vi.fn<GitHubCliPort["submitReview"]>(),
    };
    const dependencies: CliDependencies = {
      terminal: {
        commandArguments: vi.fn(),
        writeOutput: vi.fn(),
        writeError: vi.fn(),
        readInput: vi.fn<() => Promise<string>>().mockResolvedValue("Piped in."),
        finish: vi.fn(),
      },
      loadConfiguration: vi.fn<CliDependencies["loadConfiguration"]>(),
      tokenMinter: {
        mintInstallationToken: vi
          .fn<TokenMinter["mintInstallationToken"]>()
          .mockResolvedValue(succeed(secret("ghs_bot"))),
      },
      connectGitHubCli: vi.fn<CliDependencies["connectGitHubCli"]>().mockReturnValue(githubCli),
      worktree: {
        readCurrentBranch: vi.fn<GitWorktreePort["readCurrentBranch"]>(),
        readCheckoutKind: vi.fn<GitWorktreePort["readCheckoutKind"]>(),
        readPushRemote: vi.fn<GitWorktreePort["readPushRemote"]>(),
        configureWorktree: vi.fn<GitWorktreePort["configureWorktree"]>(),
      },
      readBodyFile: vi.fn<BodyFileReader>(),
      placeInStore: vi.fn<StorePlacementCheck>(),
      credentialHelperCommand: '!bun "cli-main.ts" git-credential --operation',
    };

    await ghCommand.execute({
      commandArguments: ["issue", "comment", "9", "--body-file", "-"],
      configuration,
      dependencies,
    });

    expect(githubCli.run).toHaveBeenCalledExactlyOnceWith({
      ghArguments: ["issue", "comment", "9", "--body-file", "-"],
      standardInput: "<!-- rin-bot: role=author session=9 -->\n\nPiped in.",
    });
  });
});
