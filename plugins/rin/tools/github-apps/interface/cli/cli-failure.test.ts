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
