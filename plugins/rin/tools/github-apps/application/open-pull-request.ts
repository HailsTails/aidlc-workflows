import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { PullRequestReadiness } from "../domain/pull-request.ts";
import { succeed, type Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";
import type { GitFailure, GitWorktreePort } from "./git-worktree-port.ts";

type PullRequestOpening = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly worktree: GitWorktreePort;
  readonly role: AgentRole;
  readonly title: string;
  readonly authoredBody: string;
  readonly base: string;
  readonly head: string | undefined;
  readonly readiness: PullRequestReadiness;
  readonly session: string | undefined;
};

type HeadSelection = Pick<PullRequestOpening, "head" | "worktree">;

const resolveHead = async ({
  head,
  worktree,
}: HeadSelection): Promise<Result<string, GitFailure>> =>
  head === undefined ? worktree.readCurrentBranch() : succeed(head);

const openPullRequest = async (
  opening: PullRequestOpening,
): Promise<Result<PublishedLink, GitHubFailure | GitFailure>> => {
  const head = await resolveHead(opening);
  if (head.kind === "failure") return head;
  return opening.repositoryApi.openPullRequest({
    title: opening.title,
    head: head.outcome,
    base: opening.base,
    readiness: opening.readiness,
    body: withProvenance({
      provenance: { role: opening.role, session: opening.session ?? head.outcome },
      authoredBody: opening.authoredBody,
    }),
  });
};

export { openPullRequest, type PullRequestOpening };
