import { describe, expect, it } from "vitest";
import { describeCliFailure } from "./cli-failure.ts";

describe("describeCliFailure", () => {
  it.each([
    ["blocked", "the ruleset is still waiting on a required approval or status check"],
    ["unstable", "some status checks are failing or still pending"],
    ["dirty", "it conflicts with the base branch"],
  ] as const)("names the %s merge state GitHub returned and what it waits on", (mergeState, why) => {
    expect(describeCliFailure({ kind: "pull-request-not-mergeable", pullNumber: 4, mergeState })).toBe(
      `#4 cannot merge: GitHub reports its merge state as ${mergeState}, so ${why}.`,
    );
  });

  it("explains a push remote the credential helper cannot serve", () => {
    expect(
      describeCliFailure({
        kind: "push-remote-not-https",
        remoteUrl: "git@github.com:HailsTails/minutesarah-shop.git",
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
      }),
    ).toBe(
      "This worktree pushes to git@github.com:HailsTails/minutesarah-shop.git, which the bot's credential helper cannot serve; set the push remote to https://github.com/HailsTails/minutesarah-shop.git.",
    );
  });

  it("says what an issue edit needs to change something", () => {
    expect(describeCliFailure({ kind: "issue-unchanged", issueNumber: 429 })).toBe(
      "Nothing to change on #429; pass --title, --body, --body-file, --state, --add-label, --remove-label or --attach.",
    );
  });

  it("says what a pull request edit needs to change something", () => {
    expect(describeCliFailure({ kind: "nothing-to-revise", pullNumber: 5 })).toBe(
      "Nothing to change on #5; pass --title, --body, --body-file, --add-label, --remove-label or --attach.",
    );
  });

  it("names what gh still published before it failed, so the write is not repeated", () => {
    expect(
      describeCliFailure({
        kind: "gh-command-failed",
        command: "gh issue create",
        detail: "could not upload ./a.png",
        publishedUrl: "https://github.com/HailsTails/minutesarah-shop/issues/429",
      }),
    ).toBe(
      "gh issue create failed after publishing https://github.com/HailsTails/minutesarah-shop/issues/429: could not upload ./a.png",
    );
  });

  it("names a repeatable flag given without a value", () => {
    expect(describeCliFailure({ kind: "flag-value-missing", flag: "label" })).toBe(
      "--label needs a value.",
    );
  });

  it("explains an inline body refused for carrying a private key", () => {
    expect(describeCliFailure({ kind: "inline-body-refused", reason: "contains-private-key" })).toBe(
      "Refusing to post the --body text: it contains a private key.",
    );
  });

  it("names the repository an app is missing from", () => {
    expect(
      describeCliFailure({
        kind: "app-not-installed",
        repository: { owner: "HailsTails", name: "minutesarah-shop" },
      }),
    ).toBe(
      "The GitHub App is not installed on HailsTails/minutesarah-shop; install it there first.",
    );
  });

  it("explains a GitHub rejection with its status", () => {
    expect(
      describeCliFailure({
        kind: "github-rejected",
        operation: "squash merge",
        status: 200,
        detail: "Head sha didn't match expected",
      }),
    ).toBe("GitHub refused to squash merge (200): Head sha didn't match expected");
  });
});
