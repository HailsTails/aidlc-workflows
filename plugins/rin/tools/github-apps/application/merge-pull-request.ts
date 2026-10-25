import { assessMerge, type MergeRefusal } from "../domain/merge-guard.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, MergedCommit } from "./github-repository-port.ts";

type MergeRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly pullNumber: number;
};

const mergePullRequest = async ({
  repositoryApi,
  pullNumber,
}: MergeRequest): Promise<Result<MergedCommit, GitHubFailure | MergeRefusal>> => {
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  const reviews = await repositoryApi.listReviews({ pullNumber });
  if (reviews.kind === "failure") return reviews;
  const clearance = assessMerge({ pullRequest: pullRequest.outcome, reviews: reviews.outcome });
  if (clearance.kind === "failure") return clearance;
  return repositoryApi.squashMerge({
    pullRequestId: pullRequest.outcome.nodeId,
    expectedHeadSha: clearance.outcome.headSha,
  });
};

export { mergePullRequest, type MergeRequest };
