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
      { kind: "inline-body-refused", reason: "contains-user-token" },
      "Refusing to post that text: it contains a GitHub user token.",
    ],
    [
      { kind: "body-file-refused", location: "notes.md", reason: "contains-user-token" },
      "Refusing to post notes.md: it contains a GitHub user token.",
    ],
    [
      { kind: "gh-attach-unsupported", verb: "pr merge" },
      "gh pr merge takes no --attach. Attach files with gh pr create, gh pr edit, gh pr comment, gh issue create, gh issue edit or gh issue comment.",
    ],
    [
      { kind: "user-grant-missing", path: "store/rin-author.user-grant.json" },
      'No user grant at store/rin-author.user-grant.json, and attachments are never uploaded as another identity. Run the "login" command of the bot CLI, then retry.',
    ],
    [
      { kind: "refresh-token-rejected" },
      `GitHub no longer accepts this machine's user grant; it was revoked or replaced. Run the "login" command of the bot CLI, then retry.`,
    ],
    [
      { kind: "user-authorisation-unconfigured", role: "author", path: "store/credentials.json" },
      "The author entry in store/credentials.json has no userAuthorisation.clientId, so the author app cannot act as a person. Add the app's OAuth client ID there; see the Rin GitHub bot identity guide.",
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
