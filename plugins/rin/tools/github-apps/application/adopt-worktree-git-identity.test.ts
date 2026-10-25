import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import { adoptWorktreeGitIdentity, type GitIdentityAdoption } from "./adopt-worktree-git-identity.ts";
import type { GitWorktreePort } from "./git-worktree-port.ts";

const fakeWorktree = () => ({
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
});

const minutesarahShop = { owner: "HailsTails", name: "minutesarah-shop" };

const adoption = () => ({
  repository: minutesarahShop,
  appSlug: "rin-author",
  credentialHelperCommand:
    '!bun "H:/shop/.claude/tools/github-apps/cli-main.ts" git-credential',
  mintAuthorToken: vi
    .fn<GitIdentityAdoption["mintAuthorToken"]>()
    .mockResolvedValue(succeed(secret("ghs_author"))),
});

describe("adoptWorktreeGitIdentity", () => {
  it("makes a linked worktree commit and push as the author bot", async () => {
    const worktree = fakeWorktree();

    const adopted = await adoptWorktreeGitIdentity({ ...adoption(), worktree });

    expect(adopted).toEqual(succeed({ kind: "worktree-adopted", login: "rin-author[bot]" }));
    expect(worktree.configureWorktree).toHaveBeenCalledExactlyOnceWith({
      credentialHelperCommand: adoption().credentialHelperCommand,
      committerName: "rin-author[bot]",
      committerEmail: "rin-author[bot]@users.noreply.github.com",
    });
  });

  it("leaves the primary checkout with its owner's identity", async () => {
    const worktree = fakeWorktree();
    worktree.readCheckoutKind.mockResolvedValue(succeed("primary-checkout"));

    const adopted = await adoptWorktreeGitIdentity({ ...adoption(), worktree });

    expect(adopted).toEqual(succeed({ kind: "primary-checkout-left-unchanged" }));
    expect(worktree.configureWorktree).not.toHaveBeenCalled();
  });

  it("reports a git failure while configuring", async () => {
    const worktree = fakeWorktree();
    worktree.configureWorktree.mockResolvedValue(
      fail({ kind: "git-command-failed", command: "git config", detail: "locked" }),
    );

    const adopted = await adoptWorktreeGitIdentity({ ...adoption(), worktree });

    expect(adopted).toEqual(
      fail({ kind: "git-command-failed", command: "git config", detail: "locked" }),
    );
  });

  it("leaves the worktree on its own identity while the app is not installed on the target", async () => {
    const worktree = fakeWorktree();
    const notInstalled = adoption();
    notInstalled.mintAuthorToken.mockResolvedValue(
      fail({
        kind: "app-not-installed",
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
      }),
    );

    const adopted = await adoptWorktreeGitIdentity({ ...notInstalled, worktree });

    expect(adopted).toEqual(
      fail({
        kind: "app-not-installed",
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
      }),
    );
    expect(worktree.configureWorktree).not.toHaveBeenCalled();
  });

  it("leaves the worktree on its own identity when it pushes to another repository", async () => {
    const worktree = fakeWorktree();
    worktree.readPushRemote.mockResolvedValue(succeed("https://github.com/HailsTails/rin.git"));
    const elsewhere = adoption();

    const adopted = await adoptWorktreeGitIdentity({ ...elsewhere, worktree });

    expect(adopted).toEqual(
      fail({
        kind: "push-remote-elsewhere",
        remoteUrl: "https://github.com/HailsTails/rin.git",
        repository: minutesarahShop,
      }),
    );
    expect(elsewhere.mintAuthorToken).not.toHaveBeenCalled();
    expect(worktree.configureWorktree).not.toHaveBeenCalled();
  });

  it("leaves the worktree on its own identity when its push remote cannot be read", async () => {
    const worktree = fakeWorktree();
    worktree.readPushRemote.mockResolvedValue(
      fail({ kind: "git-command-failed", command: "git remote", detail: "No such remote" }),
    );

    const adopted = await adoptWorktreeGitIdentity({ ...adoption(), worktree });

    expect(adopted).toEqual(
      fail({ kind: "git-command-failed", command: "git remote", detail: "No such remote" }),
    );
    expect(worktree.configureWorktree).not.toHaveBeenCalled();
  });

  it("does not ask for a token in the primary checkout", async () => {
    const worktree = fakeWorktree();
    worktree.readCheckoutKind.mockResolvedValue(succeed("primary-checkout"));
    const primary = adoption();

    await adoptWorktreeGitIdentity({ ...primary, worktree });

    expect(primary.mintAuthorToken).not.toHaveBeenCalled();
  });
});
