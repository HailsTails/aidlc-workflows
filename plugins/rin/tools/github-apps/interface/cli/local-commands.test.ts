import { describe, expect, it, vi } from "vitest";
import type { GitWorktreePort } from "../../application/git-worktree-port.ts";
import type { TokenMinter } from "../../application/mint-installation-token.ts";
import { fail, succeed } from "../../domain/result.ts";
import { secret } from "../../domain/secret.ts";
import type { CommandFlags } from "./command-flags.ts";
import { localCommands } from "./local-commands.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const credentialHelperCommand = '!bun "cli-main.ts" git-credential --operation';

const contextWith = (flags: CommandFlags) => ({
  flags,
  configuration: {
    repository,
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
    tokenMinter: {
      mintInstallationToken: vi
        .fn<TokenMinter["mintInstallationToken"]>()
        .mockResolvedValue(succeed(secret("ghs_reviewer"))),
    },
    connectRepository: vi.fn(),
    worktree: {
      readCurrentBranch: vi.fn(),
      readCheckoutKind: vi
        .fn<GitWorktreePort["readCheckoutKind"]>()
        .mockResolvedValue(succeed("linked-worktree")),
      readPushRemote: vi
        .fn<GitWorktreePort["readPushRemote"]>()
        .mockResolvedValue(succeed("https://github.com/HailsTails/minutesarah-shop.git")),
      configureWorktree: vi
        .fn<GitWorktreePort["configureWorktree"]>()
        .mockResolvedValue(succeed(undefined)),
    },
    readBodyFile: vi.fn(),
    credentialHelperCommand,
  },
});

describe("token", () => {
  it("prints only the token on standard output so it can feed GH_TOKEN", async () => {
    const context = contextWith({ role: "reviewer" });

    expect(await localCommands.token.execute(context)).toEqual(
      succeed({
        standardOutput: "ghs_reviewer\n",
        standardError:
          "Minted a reviewer installation token for HailsTails/minutesarah-shop; it expires within an hour.\n",
      }),
    );
    expect(context.dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "reviewer",
      appSlug: "rin-reviewer",
      repository,
    });
  });
});

describe("marker", () => {
  it("prints the provenance marker for a role and session", async () => {
    expect(
      await localCommands.marker.execute(contextWith({ role: "reviewer", session: "pr-6" })),
    ).toEqual(
      succeed({
        standardOutput: "<!-- rin-bot: role=reviewer session=pr-6 -->\n",
        standardError: "",
      }),
    );
  });
});

describe("adopt-git", () => {
  it("adopts the author bot in a linked worktree", async () => {
    const context = contextWith({});

    expect(await localCommands["adopt-git"].execute(context)).toEqual(
      succeed({
        standardOutput:
          "This worktree now commits and pushes as rin-author[bot]; plain git commit and git push use the bot.\n",
        standardError: "",
      }),
    );
    expect(context.dependencies.worktree.configureWorktree).toHaveBeenCalledExactlyOnceWith({
      credentialHelperCommand,
      committerName: "rin-author[bot]",
      committerEmail: "rin-author[bot]@users.noreply.github.com",
    });
  });

  it("keeps the worktree's own identity until the author app is installed on the target", async () => {
    const context = contextWith({});
    context.dependencies.tokenMinter.mintInstallationToken.mockResolvedValue(
      fail({ kind: "app-not-installed", repository }),
    );

    expect(await localCommands["adopt-git"].execute(context)).toEqual(
      fail({ kind: "app-not-installed", repository }),
    );
    expect(context.dependencies.tokenMinter.mintInstallationToken).toHaveBeenCalledExactlyOnceWith({
      role: "author",
      appSlug: "rin-author",
      repository,
    });
    expect(context.dependencies.worktree.configureWorktree).not.toHaveBeenCalled();
  });

  it("leaves the primary checkout alone", async () => {
    const context = contextWith({});
    context.dependencies.worktree.readCheckoutKind.mockResolvedValue(succeed("primary-checkout"));

    expect(await localCommands["adopt-git"].execute(context)).toEqual(
      succeed({
        standardOutput: "Left the primary checkout alone: it keeps its owner's git identity.\n",
        standardError: "",
      }),
    );
  });
});

describe("git-credential", () => {
  it("ignores git's store and erase operations", async () => {
    const context = contextWith({ operation: "erase" });

    expect(await localCommands["git-credential"].execute(context)).toEqual(
      succeed({ standardOutput: "", standardError: "" }),
    );
    expect(context.dependencies.terminal.readInput).not.toHaveBeenCalled();
  });
});
