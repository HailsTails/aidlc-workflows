import { z } from "zod";
import type {
  GhReadFailed,
  GhRun,
  GhUnavailable,
  GitHubCliPort,
} from "../application/github-cli-port.ts";
import { formatRepositorySlug, type RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import {
  graphqlReviewEventOf,
  pullRequestNodeSchema,
  pullRequestSnapshotOf,
  reviewNodeSchema,
  reviewRecordOf,
} from "./github-pull-request-wire.ts";
import { parseJsonText } from "./json-text.ts";
import type { ProcessRunner } from "./process-runner.ts";

const GH = "gh";

const PULL_REQUEST_FIELDS = "id,number,headRefOid,state,isDraft,mergeStateStatus,reviews";

const SUBMIT_REVIEW_MUTATION = `mutation SubmitReview($pullRequestId: ID!, $event: PullRequestReviewEvent!, $commitOID: GitObjectID!, $body: String!) {
  addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, commitOID: $commitOID, body: $body }) { pullRequestReview { url } }
}`;

const REVIEW_URL = ".data.addPullRequestReview.pullRequestReview.url";

const READ_PULL_REQUEST = "read pull request";

const pullRequestViewSchema = pullRequestNodeSchema.extend({ reviews: z.array(reviewNodeSchema) });

type GitHubCliConnection = {
  readonly runProcess: ProcessRunner;
  readonly credential: Secret;
  readonly repository: RepositorySlug;
};

type GhCall = {
  readonly connection: GitHubCliConnection;
  readonly ghArguments: readonly string[];
  readonly standardInput: string | undefined;
};

const runGh = async ({
  connection,
  ghArguments,
  standardInput,
}: GhCall): Promise<Result<GhRun, GhUnavailable>> => {
  const ran = await connection.runProcess({
    command: GH,
    commandArguments: ghArguments,
    environment: { GH_TOKEN: connection.credential.reveal(), GH_PROMPT_DISABLED: "1" },
    standardInput,
  });
  if (ran.kind === "failure") return fail({ kind: "gh-unavailable", detail: ran.reason.detail });
  return succeed(ran.outcome);
};

const inRepository = (connection: GitHubCliConnection, ghArguments: readonly string[]) => [
  ...ghArguments,
  "--repo",
  formatRepositorySlug(connection.repository),
];

const readFailure = (detail: string): GhReadFailed => ({
  kind: "gh-read-failed",
  operation: READ_PULL_REQUEST,
  detail,
});

const readPullRequest =
  (connection: GitHubCliConnection): GitHubCliPort["readPullRequest"] =>
  async (pullNumber) => {
    const viewed = await runGh({
      connection,
      ghArguments: inRepository(connection, [
        "pr",
        "view",
        String(pullNumber),
        "--json",
        PULL_REQUEST_FIELDS,
      ]),
      standardInput: undefined,
    });
    if (viewed.kind === "failure") return viewed;
    const { exitCode, standardOutput, standardError } = viewed.outcome;
    if (exitCode !== 0) return fail(readFailure(standardError.trim()));
    const json = parseJsonText(standardOutput);
    if (json.kind === "failure") return fail(readFailure("gh printed something other than JSON"));
    const view = pullRequestViewSchema.safeParse(json.outcome);
    if (!view.success) return fail(readFailure(view.error.message));
    return succeed({
      pullRequest: pullRequestSnapshotOf(view.data),
      reviews: view.data.reviews.map(reviewRecordOf),
    });
  };

const createGitHubCli = (connection: GitHubCliConnection): GitHubCliPort => ({
  run: ({ ghArguments, standardInput }) =>
    runGh({ connection, ghArguments: inRepository(connection, ghArguments), standardInput }),
  readPullRequest: readPullRequest(connection),
  submitReview: ({ pullRequestId, commitSha, event, body }) =>
    runGh({
      connection,
      ghArguments: [
        "api",
        "graphql",
        "-f",
        `query=${SUBMIT_REVIEW_MUTATION}`,
        "-f",
        `pullRequestId=${pullRequestId}`,
        "-f",
        `event=${graphqlReviewEventOf(event)}`,
        "-f",
        `commitOID=${commitSha}`,
        "-F",
        "body=@-",
        "--jq",
        REVIEW_URL,
      ],
      standardInput: body,
    }),
});

export { createGitHubCli, type GitHubCliConnection };
