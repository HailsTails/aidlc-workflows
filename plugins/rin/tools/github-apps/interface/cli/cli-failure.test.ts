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
