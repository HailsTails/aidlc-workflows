import { describe, expect, it } from "vitest";
import { describeCliFailure, type CliFailure } from "./cli-failure.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

describe("describeCliFailure", () => {
  it.each<readonly [CliFailure, string]>([
    [
      { kind: "gh-verb-unsupported", verb: "pr view" },
      '"gh pr view" is not a write the bot wrapper runs. It runs: gh pr create, gh pr edit, gh pr comment, gh pr ready, gh pr merge, gh pr close, gh pr review, gh issue create, gh issue edit, gh issue comment, gh issue close, gh issue reopen. Run reads as plain gh.',
    ],
    [
      { kind: "gh-flag-refused", flag: "--admin" },
      "--admin is refused: the wrapper pins the repository, never bypasses rulesets, never opens a browser or editor, and never posts a body it did not stamp. Drop --admin and give the text with --body or --body-file.",
    ],
    [
      { kind: "gh-target-required", verb: "pr close" },
      'gh pr close needs the pull request number right after the verb, as in "gh pr close 12 ...".',
    ],
    [
      { kind: "gh-unavailable", detail: "spawn gh ENOENT" },
      "gh could not be run: spawn gh ENOENT. Install GitHub CLI 2.103.2 or later and put it on PATH.",
    ],
    [
      { kind: "attachment-refused", attachment: "keys/a.pem" },
      "Refusing to attach keys/a.pem: it is inside the bot credential store.",
    ],
    [
      {
        kind: "push-remote-not-https",
        remoteUrl: "git@github.com:HailsTails/minutesarah-shop.git",
        repository,
      },
      "This worktree pushes to git@github.com:HailsTails/minutesarah-shop.git, which the bot's credential helper cannot serve; set the push remote to https://github.com/HailsTails/minutesarah-shop.git.",
    ],
    [{ kind: "flag-value-missing", flag: "role" }, "--role needs a value."],
    [
      { kind: "inline-body-refused", reason: "contains-private-key" },
      "Refusing to post that text: it contains a private key.",
    ],
    [
      { kind: "inline-body-refused", reason: "contains-github-token" },
      "Refusing to post that text: it contains a GitHub token.",
    ],
    [
      { kind: "body-file-refused", location: "notes.md", reason: "contains-github-token" },
      "Refusing to post notes.md: it contains a GitHub token.",
    ],
    [
      { kind: "created-number-unreadable" },
      "gh did not print the URL of what it created, so there was nothing to attach the files to.",
    ],
    [
      { kind: "gh-attach-unsupported", verb: "pr merge" },
      "gh pr merge takes no --attach. Attach files with gh pr create, gh pr edit, gh pr comment, gh issue create, gh issue edit or gh issue comment.",
    ],
    [
      { kind: "gh-attach-target-not-number", verb: "pr comment" },
      'gh pr comment with --attach needs the number right after the verb, as in "gh pr comment 12 --attach shot.png". A URL, a branch or a flag in that place is refused: the write runs under the operator\'s grant, which GitHub does not limit to this repository.',
    ],
    [
      { kind: "gh-attach-argument-refused", verb: "issue comment", token: "--delete-last" },
      'Refusing "--delete-last" on gh issue comment with --attach. That write runs under the operator\'s grant, which GitHub does not limit to this repository, so it accepts only the number, --body or --body-file, --attach and these flags: --edit-last, --create-if-none. Make any other change in a separate write without --attach.',
    ],
    [
      { kind: "gh-attach-not-local-file", attachment: "https://github.com/other/repo/issues/3" },
      '--attach takes a local file, and "https://github.com/other/repo/issues/3" contains a URL.',
    ],
    [
      { kind: "gh-attach-dry-run-refused" },
      "--dry-run creates nothing, so there is nothing to attach files to. Drop --attach or --dry-run.",
    ],
    [
      { kind: "user-grant-lock-unwritable", path: "store/author.user-grant.lock", detail: "ENOENT" },
      "Cannot create the user grant lock at store/author.user-grant.lock: ENOENT. Check that the credential store directory exists and can be written.",
    ],
    [
      { kind: "user-grant-unwritable", path: "store/author.user-grant.json", detail: "EPERM: rename" },
      'Cannot write the user grant to store/author.user-grant.json: EPERM: rename. If a refresh had just succeeded, the grant on disk is now out of date. Run the "login" command of the bot CLI, then retry.',
    ],
    [
      { kind: "user-grant-missing", path: "store/author.user-grant.json" },
      'No user grant at store/author.user-grant.json, and attachments are never uploaded under another identity. Run the "login" command of the bot CLI, then retry.',
    ],
    [
      { kind: "refresh-token-rejected" },
      `GitHub no longer accepts this machine's user grant; it was revoked or replaced. Run the "login" command of the bot CLI, then retry.`,
    ],
    [
      { kind: "user-authorisation-unconfigured", role: "author", path: "store/credentials.json" },
      "The author entry in store/credentials.json has no userAuthorisation.clientId, so the author role cannot upload attachments. Add the OAuth app's client ID and scope there; see the Rin GitHub bot identity guide.",
    ],
    [
      { kind: "app-not-installed", repository },
      "The GitHub App is not installed on HailsTails/minutesarah-shop; install it there first.",
    ],
    [
      {
        kind: "github-rejected",
        operation: "mint an installation token",
        status: 403,
        detail: "Resource not accessible by integration",
      },
      "GitHub refused to mint an installation token (403): Resource not accessible by integration",
    ],
  ])("describes %j", (failure, description) => {
    expect(describeCliFailure(failure)).toBe(description);
  });
});
