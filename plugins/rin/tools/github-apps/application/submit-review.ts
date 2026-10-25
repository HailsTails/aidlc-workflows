import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { ReviewEvent } from "../domain/pull-request.ts";
import type { Result } from "../domain/result.ts";
import { assessReviewTarget, type ReviewRefusal } from "../domain/review-guard.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type ReviewRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly pullNumber: number;
  readonly event: ReviewEvent;
  readonly reviewedSha: string | undefined;
  readonly authoredBody: string;
  readonly session: string | undefined;
};

const submitReview = async ({
  repositoryApi,
  role,
  pullNumber,
  event,
  reviewedSha,
  authoredBody,
  session,
}: ReviewRequest): Promise<Result<PublishedLink, GitHubFailure | ReviewRefusal>> => {
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  const binding = assessReviewTarget({ pullRequest: pullRequest.outcome, reviewedSha });
  if (binding.kind === "failure") return binding;
  return repositoryApi.submitReview({
    pullRequestId: pullRequest.outcome.nodeId,
    event,
    commitSha: binding.outcome.commitSha,
    body: withProvenance({
      provenance: { role, session: session ?? String(pullNumber) },
      authoredBody,
    }),
  });
};

export { submitReview, type ReviewRequest };
