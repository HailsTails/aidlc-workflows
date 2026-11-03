import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { PullRequestReadiness } from "../domain/pull-request.ts";
import { succeed, type Result } from "../domain/result.ts";
import type { GitHubCliFailure, GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";
import type { GitFailure, GitWorktreePort } from "./git-worktree-port.ts";

type PullRequestOpening = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly githubCli: GitHubCliPort;
  readonly worktree: GitWorktreePort;
  readonly role: AgentRole;
  readonly title: string;
  readonly authoredBody: string;
  readonly base: string;
  readonly head: string | undefined;
  readonly readiness: PullRequestReadiness;
  readonly labels: readonly string[];
  readonly attachments: readonly string[];
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
): Promise<Result<PublishedLink, GitHubFailure | GitHubCliFailure | GitFailure>> => {
  const head = await resolveHead(opening);
  if (head.kind === "failure") return head;
  const proposal = {
    title: opening.title,
    head: head.outcome,
    base: opening.base,
    readiness: opening.readiness,
    labels: opening.labels,
    body: withProvenance({
      provenance: { role: opening.role, session: opening.session ?? head.outcome },
      authoredBody: opening.authoredBody,
    }),
  };
  return opening.attachments.length === 0
    ? opening.repositoryApi.openPullRequest(proposal)
    : opening.githubCli.openPullRequest({ ...proposal, attachments: opening.attachments });
};

export { openPullRequest, type PullRequestOpening };
