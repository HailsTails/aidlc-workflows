import type { AgentRole } from "../domain/agent-role.ts";
import { changesLabels, type LabelChange } from "../domain/label-change.ts";
import { withProvenance } from "../domain/provenance.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { GitHubCliFailure, GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, RevisedLabelable } from "./github-repository-port.ts";

type PullRequestRevisionRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly githubCli: GitHubCliPort;
  readonly role: AgentRole;
  readonly pullNumber: number;
  readonly title: string | undefined;
  readonly authoredBody: string | undefined;
  readonly labels: LabelChange;
  readonly attachments: readonly string[];
  readonly session: string | undefined;
};

type NothingToRevise = { readonly kind: "nothing-to-revise"; readonly pullNumber: number };

const changesSomething = ({
  title,
  authoredBody,
  labels,
  attachments,
}: PullRequestRevisionRequest): boolean =>
  title !== undefined || authoredBody !== undefined || changesLabels(labels) || attachments.length > 0;

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

const reviseThroughGitHubCli = async (
  request: PullRequestRevisionRequest,
): Promise<Result<RevisedLabelable, GitHubCliFailure>> => {
  const { githubCli, pullNumber, title, labels, attachments } = request;
  const revised = await githubCli.revisePullRequest({
    pullNumber,
    title,
    body: attributedBody(request),
    labels,
    attachments,
  });
  if (revised.kind === "failure") return revised;
  return succeed({ ...revised.outcome, missingLabels: [] });
};

const revisePullRequest = async (
  request: PullRequestRevisionRequest,
): Promise<Result<RevisedLabelable, GitHubFailure | GitHubCliFailure | NothingToRevise>> => {
  const { repositoryApi, pullNumber, title, labels, attachments } = request;
  if (!changesSomething(request)) return fail({ kind: "nothing-to-revise", pullNumber });
  if (attachments.length > 0) return reviseThroughGitHubCli(request);
  const pullRequest = await repositoryApi.readPullRequest({ pullNumber });
  if (pullRequest.kind === "failure") return pullRequest;
  return repositoryApi.revisePullRequest({
    pullRequestId: pullRequest.outcome.nodeId,
    title,
    body: attributedBody(request),
    labels,
  });
};

export { revisePullRequest, type NothingToRevise, type PullRequestRevisionRequest };
