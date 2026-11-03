import { describe, expect, it, vi } from "vitest";
import { fail, succeed } from "../domain/result.ts";
import { secret } from "../domain/secret.ts";
import type { CommandRunner } from "./command-runner.ts";
import { createGitHubCli } from "./github-cli.ts";

const repository = { owner: "HailsTails", name: "minutesarah-shop" };

const issueUrl = "https://github.com/HailsTails/minutesarah-shop/issues/429";

const botEnvironment = { GH_TOKEN: "ghs_author", GH_PROMPT_DISABLED: "1" };

const printing = (standardOutput: string) =>
  vi.fn<CommandRunner>().mockResolvedValue(succeed(standardOutput));

const ghCli = (runCommand: CommandRunner) =>
  createGitHubCli({ runCommand, credential: secret("ghs_author"), repository });

describe("createGitHubCli", () => {
  it("opens a pull request through gh as the bot, with the body on standard input", async () => {
    const runCommand = printing("https://github.com/HailsTails/minutesarah-shop/pull/7\n");

    const opened = await ghCli(runCommand).openPullRequest({
      title: "Add the basket",
      body: "marker\n\n![Basket](./basket.png)",
      head: "feature/basket",
      base: "main",
      readiness: "draft",
      labels: ["stage:review"],
      attachments: ["./basket.png", "./after.png#After"],
    });

    expect(opened).toEqual(succeed({ url: "https://github.com/HailsTails/minutesarah-shop/pull/7" }));
    expect(runCommand).toHaveBeenCalledExactlyOnceWith({
      command: "gh",
      commandArguments: [
        "pr",
        "create",
        "--title",
        "Add the basket",
        "--head",
        "feature/basket",
        "--base",
        "main",
        "--draft",
        "--label",
        "stage:review",
        "--body-file",
        "-",
        "--attach",
        "./basket.png",
        "--attach",
        "./after.png#After",
        "--repo",
        "HailsTails/minutesarah-shop",
      ],
      environment: botEnvironment,
      standardInput: "marker\n\n![Basket](./basket.png)",
    });
  });

  it("edits a pull request without a body flag when the body is unchanged", async () => {
    const runCommand = printing("https://github.com/HailsTails/minutesarah-shop/pull/7\n");

    await ghCli(runCommand).revisePullRequest({
      pullNumber: 7,
      title: undefined,
      body: undefined,
      labels: { add: ["stage:review"], remove: ["stage:build"] },
      attachments: ["./after.png"],
    });

    expect(runCommand).toHaveBeenCalledExactlyOnceWith({
      command: "gh",
      commandArguments: [
        "pr",
        "edit",
        "7",
        "--add-label",
        "stage:review",
        "--remove-label",
        "stage:build",
        "--attach",
        "./after.png",
        "--repo",
        "HailsTails/minutesarah-shop",
      ],
      environment: botEnvironment,
      standardInput: undefined,
    });
  });

  it("comments through gh issue comment, which serves pull requests too", async () => {
    const runCommand = printing(`${issueUrl}#issuecomment-9\n`);

    const commented = await ghCli(runCommand).commentOnIssue({
      issueNumber: 429,
      body: "marker\n\nSee recording.",
      attachments: ["./repro.mp4"],
    });

    expect(commented).toEqual(succeed({ url: `${issueUrl}#issuecomment-9` }));
    expect(runCommand.mock.lastCall?.[0].commandArguments.slice(0, 3)).toEqual([
      "issue",
      "comment",
      "429",
    ]);
  });

  it("opens and edits issues through gh", async () => {
    const runCommand = printing(`${issueUrl}\n`);
    const cli = ghCli(runCommand);

    await cli.openIssue({ title: "Basket", body: "B", labels: ["bug"], attachments: ["./a.png"] });
    await cli.reviseIssue({
      issueNumber: 429,
      title: "Basket keeps items",
      body: undefined,
      labels: { add: [], remove: [] },
      attachments: ["./b.png"],
    });

    expect(runCommand.mock.calls.map(([invocation]) => invocation.commandArguments)).toEqual([
      ["issue", "create", "--title", "Basket", "--label", "bug", "--body-file", "-", "--attach", "./a.png", "--repo", "HailsTails/minutesarah-shop"],
      ["issue", "edit", "429", "--title", "Basket keeps items", "--attach", "./b.png", "--repo", "HailsTails/minutesarah-shop"],
    ]);
  });

  it("reports what gh still published when an attachment failed", async () => {
    const runCommand = vi.fn<CommandRunner>().mockResolvedValue(
      fail({
        kind: "command-failed",
        command: "gh issue create",
        detail: "could not upload ./a.png",
        standardOutput: `${issueUrl}\n`,
      }),
    );

    expect(
      await ghCli(runCommand).openIssue({
        title: "Basket",
        body: "B",
        labels: [],
        attachments: ["./a.png"],
      }),
    ).toEqual(
      fail({
        kind: "gh-command-failed",
        command: "gh issue create",
        detail: "could not upload ./a.png",
        publishedUrl: issueUrl,
      }),
    );
  });

  it("refuses a gh run that printed no url", async () => {
    const opened = await ghCli(printing("\n")).openIssue({
      title: "Basket",
      body: "B",
      labels: [],
      attachments: ["./a.png"],
    });

    expect(opened).toEqual(
      fail({
        kind: "gh-command-failed",
        command: "gh issue create --title Basket",
        detail: "gh printed no URL",
        publishedUrl: undefined,
      }),
    );
  });
});
