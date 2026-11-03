import type { AgentRole } from "../domain/agent-role.ts";
import type { IssueState } from "../domain/issue.ts";
import { changesLabels, type LabelChange } from "../domain/label-change.ts";
import { withProvenance } from "../domain/provenance.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { GitHubCliFailure, GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, RevisedLabelable } from "./github-repository-port.ts";

const NO_LABEL_CHANGE: LabelChange = { add: [], remove: [] };

type IssueRevisionRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly githubCli: GitHubCliPort;
  readonly role: AgentRole;
  readonly issueNumber: number;
  readonly title: string | undefined;
  readonly authoredBody: string | undefined;
  readonly state: IssueState | undefined;
  readonly labels: LabelChange;
  readonly attachments: readonly string[];
  readonly session: string | undefined;
};

type IssueUnchanged = { readonly kind: "issue-unchanged"; readonly issueNumber: number };

type IssueRevisionResult = Result<RevisedLabelable, GitHubFailure | GitHubCliFailure | IssueUnchanged>;

const changesSomething = ({
  title,
  authoredBody,
  state,
  labels,
  attachments,
}: IssueRevisionRequest): boolean =>
  title !== undefined ||
  authoredBody !== undefined ||
  state !== undefined ||
  changesLabels(labels) ||
  attachments.length > 0;

const attributedBody = ({
  role,
  issueNumber,
  authoredBody,
  session,
}: IssueRevisionRequest): string | undefined =>
  authoredBody === undefined
    ? undefined
    : withProvenance({
        provenance: { role, session: session ?? String(issueNumber) },
        authoredBody,
      });

const reviseThroughGitHubCli = async (request: IssueRevisionRequest): Promise<IssueRevisionResult> => {
  const { repositoryApi, githubCli, issueNumber, title, state, labels, attachments } = request;
  const edited = await githubCli.reviseIssue({
    issueNumber,
    title,
    body: attributedBody(request),
    labels,
    attachments,
  });
  if (edited.kind === "failure") return edited;
  if (state === undefined) return succeed({ ...edited.outcome, missingLabels: [] });
  return repositoryApi.reviseIssue({
    issueNumber,
    title: undefined,
    body: undefined,
    state,
    labels: NO_LABEL_CHANGE,
  });
};

const reviseIssue = async (request: IssueRevisionRequest): Promise<IssueRevisionResult> => {
  const { repositoryApi, issueNumber, title, state, labels, attachments } = request;
  if (!changesSomething(request)) return fail({ kind: "issue-unchanged", issueNumber });
  if (attachments.length > 0) return reviseThroughGitHubCli(request);
  return repositoryApi.reviseIssue({
    issueNumber,
    title,
    body: attributedBody(request),
    state,
    labels,
  });
};

export { reviseIssue, type IssueRevisionRequest, type IssueUnchanged };
