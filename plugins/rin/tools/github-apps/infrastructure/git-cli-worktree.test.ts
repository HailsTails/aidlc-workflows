import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import type { CommandRunner } from "./command-runner.ts";
import { createGitCliWorktree, credentialHelperCommandFor } from "./git-cli-worktree.ts";

const printing = (standardOutput: string) =>
  vi.fn<CommandRunner>().mockResolvedValue(succeed(standardOutput));

const settings = {
  credentialHelperCommand: '!bun "H:/shop/.claude/tools/github-apps/cli-main.ts" git-credential',
  committerName: "rin-author[bot]",
  committerEmail: "rin-author[bot]@users.noreply.github.com",
};

const expectedConfigurationCalls = [
  [{ command: "git", commandArguments: ["config", "extensions.worktreeConfig", "true"] }],
  [
    {
      command: "git",
      commandArguments: ["config", "--worktree", "--replace-all", "credential.helper", ""],
    },
  ],
  [
    {
      command: "git",
      commandArguments: [
        "config",
        "--worktree",
        "--add",
        "credential.helper",
        settings.credentialHelperCommand,
      ],
    },
  ],
  [
    {
      command: "git",
      commandArguments: ["config", "--worktree", "credential.useHttpPath", "true"],
    },
  ],
  [
    {
      command: "git",
      commandArguments: ["config", "--worktree", "credential.interactive", "false"],
    },
  ],
  [{ command: "git", commandArguments: ["config", "--worktree", "user.name", "rin-author[bot]"] }],
  [
    {
      command: "git",
      commandArguments: [
        "config",
        "--worktree",
        "user.email",
        "rin-author[bot]@users.noreply.github.com",
      ],
    },
  ],
];

describe("createGitCliWorktree", () => {
  it("reads the checked-out branch", async () => {
    const runCommand = printing("feature/basket\n");

    expect(await createGitCliWorktree({ runCommand }).readCurrentBranch()).toEqual(
      succeed("feature/basket"),
    );
    expect(runCommand).toHaveBeenCalledExactlyOnceWith({
      command: "git",
      commandArguments: ["rev-parse", "--abbrev-ref", "HEAD"],
    });
  });

  it("reports a detached head instead of a branch called HEAD", async () => {
    expect(
      await createGitCliWorktree({ runCommand: printing("HEAD\n") }).readCurrentBranch(),
    ).toEqual(fail({ kind: "branch-detached" }));
  });

  it("recognises a linked worktree by its own git directory", async () => {
    const runCommand = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(succeed("H:/shop/.git\n"))
      .mockResolvedValueOnce(succeed("H:/shop/.git/worktrees/feature\n"));

    expect(await createGitCliWorktree({ runCommand }).readCheckoutKind()).toEqual(
      succeed("linked-worktree"),
    );
  });

  it("recognises the primary checkout", async () => {
    expect(
      await createGitCliWorktree({ runCommand: printing("H:/shop/.git\n") }).readCheckoutKind(),
    ).toEqual(succeed("primary-checkout"));
  });
});

describe("createGitCliWorktree configuration", () => {
  it("configures this worktree alone to commit and authenticate as the bot", async () => {
    const runCommand = printing("");

    expect(await createGitCliWorktree({ runCommand }).configureWorktree(settings)).toEqual(
      succeed(undefined),
    );
    expect(runCommand.mock.calls).toEqual(expectedConfigurationCalls);
  });

  it("stops configuring at the first git failure", async () => {
    const runCommand = vi
      .fn<CommandRunner>()
      .mockResolvedValueOnce(succeed(""))
      .mockResolvedValueOnce(
        fail({
          kind: "command-failed",
          command: "git config",
          detail: "could not lock config file",
        }),
      );

    expect(await createGitCliWorktree({ runCommand }).configureWorktree(settings)).toEqual(
      fail({
        kind: "git-command-failed",
        command: "git config",
        detail: "could not lock config file",
      }),
    );
    expect(runCommand).toHaveBeenCalledTimes(2);
  });
});

describe("credentialHelperCommandFor", () => {
  it("runs the CLI entry through bun, leaving git to append the operation", () => {
    expect(
      credentialHelperCommandFor({
        cliEntryPath: "H:\\shop\\.claude\\tools\\github-apps\\cli-main.ts",
      }),
    ).toBe('!bun "H:/shop/.claude/tools/github-apps/cli-main.ts" git-credential --operation');
  });
});
