import type { GitHubCliFailure, GitHubCliPort } from "../application/github-cli-port.ts";
import type { PublishedLink } from "../application/github-repository-port.ts";
import { formatRepositorySlug, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { CommandRunner } from "./command-runner.ts";

const GH = "gh";

const BODY_FROM_STANDARD_INPUT = ["--body-file", "-"] as const;

type GitHubCliConnection = {
  readonly runCommand: CommandRunner;
  readonly credential: Secret;
  readonly repository: RepositorySlug;
};

type GhWrite = {
  readonly connection: GitHubCliConnection;
  readonly ghArguments: readonly string[];
  readonly body: string | undefined;
  readonly attachments: readonly string[];
};

const repeated = (flag: string, values: readonly string[]): readonly string[] =>
  values.flatMap((value) => [flag, value]);

const optional = (flag: string, value: string | undefined): readonly string[] =>
  value === undefined ? [] : [flag, value];

const bodyArguments = (body: string | undefined): readonly string[] =>
  body === undefined ? [] : BODY_FROM_STANDARD_INPUT;

const printedUrl = (standardOutput: string): string | undefined =>
  standardOutput
    .split("\n")
    .map((line) => line.trim())
    .findLast((line) => line !== "");

const runGh = async ({
  connection,
  ghArguments,
  body,
  attachments,
}: GhWrite): Promise<Result<PublishedLink, GitHubCliFailure>> => {
  const ran = await connection.runCommand({
    command: GH,
    commandArguments: [
      ...ghArguments,
      ...bodyArguments(body),
      ...repeated("--attach", attachments),
      "--repo",
      formatRepositorySlug(connection.repository),
    ],
    environment: { GH_TOKEN: connection.credential.reveal(), GH_PROMPT_DISABLED: "1" },
    standardInput: body,
  });
  if (ran.kind === "failure") {
    return fail({
      kind: "gh-command-failed",
      command: ran.reason.command,
      detail: ran.reason.detail,
      publishedUrl: printedUrl(ran.reason.standardOutput),
    });
  }
  const url = printedUrl(ran.outcome);
  if (url === undefined) {
    return fail({
      kind: "gh-command-failed",
      command: [GH, ...ghArguments].join(" "),
      detail: "gh printed no URL",
      publishedUrl: undefined,
    });
  }
  return succeed({ url });
};

const createGitHubCli = (connection: GitHubCliConnection): GitHubCliPort => ({
  openPullRequest: ({ title, body, head, base, readiness, labels, attachments }) =>
    runGh({
      connection,
      ghArguments: [
        "pr",
        "create",
        "--title",
        title,
        "--head",
        head,
        "--base",
        base,
        ...(readiness === "draft" ? ["--draft"] : []),
        ...repeated("--label", labels),
      ],
      body,
      attachments,
    }),
  revisePullRequest: ({ pullNumber, title, body, labels, attachments }) =>
    runGh({
      connection,
      ghArguments: [
        "pr",
        "edit",
        String(pullNumber),
        ...optional("--title", title),
        ...repeated("--add-label", labels.add),
        ...repeated("--remove-label", labels.remove),
      ],
      body,
      attachments,
    }),
  commentOnIssue: ({ issueNumber, body, attachments }) =>
    runGh({
      connection,
      ghArguments: ["issue", "comment", String(issueNumber)],
      body,
      attachments,
    }),
  openIssue: ({ title, body, labels, attachments }) =>
    runGh({
      connection,
      ghArguments: ["issue", "create", "--title", title, ...repeated("--label", labels)],
      body,
      attachments,
    }),
  reviseIssue: ({ issueNumber, title, body, labels, attachments }) =>
    runGh({
      connection,
      ghArguments: [
        "issue",
        "edit",
        String(issueNumber),
        ...optional("--title", title),
        ...repeated("--add-label", labels.add),
        ...repeated("--remove-label", labels.remove),
      ],
      body,
      attachments,
    }),
});

export { createGitHubCli, type GitHubCliConnection };
