import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import { fail, type Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type PullRequestRevisionRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly pullNumber: number;
  readonly title: string | undefined;
  readonly authoredBody: string | undefined;
  readonly session: string | undefined;
};

type NothingToRevise = { readonly kind: "nothing-to-revise"; readonly pullNumber: number };

const attributedBody = ({
  role,
  pullNumber,
  authoredBody,
  session,
}: PullRequestRevisionRequest): string | undefined =>
  authoredBody === undefined
    ? undefined
    : withProvenance({
        provenance: { role, session: session ?? String(pullNumber) },
        authoredBody,
      });

const revisePullRequest = async (
  request: PullRequestRevisionRequest,
): Promise<Result<PublishedLink, GitHubFailure | NothingToRevise>> => {
  const { repositoryApi, pullNumber, title, authoredBody } = request;
  if (title === undefined && authoredBody === undefined) {
    return fail({ kind: "nothing-to-revise", pullNumber });
  }
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  return repositoryApi.revisePullRequest({
    pullRequestId: pullRequest.outcome.nodeId,
    title,
    body: attributedBody(request),
  });
};

export { revisePullRequest, type NothingToRevise, type PullRequestRevisionRequest };
