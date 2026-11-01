import type { AgentRole } from "../domain/agent-role.ts";
import { changesLabels, type IssueState, type LabelChange } from "../domain/issue.ts";
import { withProvenance } from "../domain/provenance.ts";
import { fail, type Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type IssueRevisionRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly issueNumber: number;
  readonly title: string | undefined;
  readonly authoredBody: string | undefined;
  readonly state: IssueState | undefined;
  readonly labels: LabelChange;
  readonly session: string | undefined;
};

type IssueUnchanged = { readonly kind: "issue-unchanged"; readonly issueNumber: number };

const changesSomething = ({ title, authoredBody, state, labels }: IssueRevisionRequest): boolean =>
  title !== undefined || authoredBody !== undefined || state !== undefined || changesLabels(labels);

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

const reviseIssue = async (
  request: IssueRevisionRequest,
): Promise<Result<PublishedLink, GitHubFailure | IssueUnchanged>> => {
  const { repositoryApi, issueNumber, title, state, labels } = request;
  if (!changesSomething(request)) return fail({ kind: "issue-unchanged", issueNumber });
  return repositoryApi.reviseIssue({
    issueNumber,
    title,
    body: attributedBody(request),
    state,
    labels,
  });
};

export { reviseIssue, type IssueRevisionRequest, type IssueUnchanged };
