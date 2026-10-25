import type { AgentRole } from "../domain/agent-role.ts";
import { assessClose, type CloseRefusal } from "../domain/close-guard.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type CloseRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly pullNumber: number;
  readonly reason: string;
};

const closePullRequest = async ({
  repositoryApi,
  role,
  pullNumber,
  reason,
}: CloseRequest): Promise<Result<PublishedLink, GitHubFailure | CloseRefusal>> => {
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  const reviews = await repositoryApi.listReviews({ pullNumber });
  if (reviews.kind === "failure") return reviews;
  const clearance = assessClose({ pullRequest: pullRequest.outcome, reviews: reviews.outcome });
  if (clearance.kind === "failure") return clearance;
  const explanation = await repositoryApi.commentOnIssue({
    issueNumber: pullNumber,
    body: withProvenance({
      provenance: { role, session: String(pullNumber) },
      authoredBody: `superseded: ${reason}`,
    }),
  });
  if (explanation.kind === "failure") return explanation;
  return repositoryApi.closePullRequest({ pullRequestId: pullRequest.outcome.nodeId });
};

export { closePullRequest, type CloseRequest };
