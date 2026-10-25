import {
  requireOpenPullRequest,
  type PullRequestNotOpen,
  type PullRequestReadiness,
} from "../domain/pull-request.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort } from "./github-repository-port.ts";

type ReadinessRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly pullNumber: number;
  readonly readiness: PullRequestReadiness;
};

const changeReadiness = async ({
  repositoryApi,
  pullNumber,
  readiness,
}: ReadinessRequest): Promise<Result<PullRequestReadiness, GitHubFailure | PullRequestNotOpen>> => {
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  const openPullRequest = requireOpenPullRequest(pullRequest.outcome);
  if (openPullRequest.kind === "failure") return openPullRequest;
  return repositoryApi.changeReadiness({
    pullRequestId: openPullRequest.outcome.nodeId,
    readiness,
  });
};

export { changeReadiness, type ReadinessRequest };
