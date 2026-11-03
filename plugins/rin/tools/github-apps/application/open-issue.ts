import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubCliFailure, GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

const NEW_ISSUE_SESSION = "new-issue";

type IssueOpening = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly githubCli: GitHubCliPort;
  readonly role: AgentRole;
  readonly title: string;
  readonly authoredBody: string;
  readonly labels: readonly string[];
  readonly attachments: readonly string[];
  readonly session: string | undefined;
};

const openIssue = ({
  repositoryApi,
  githubCli,
  role,
  title,
  authoredBody,
  labels,
  attachments,
  session,
}: IssueOpening): Promise<Result<PublishedLink, GitHubFailure | GitHubCliFailure>> => {
  const proposal = {
    title,
    body: withProvenance({
      provenance: { role, session: session ?? NEW_ISSUE_SESSION },
      authoredBody,
    }),
    labels,
  };
  return attachments.length === 0
    ? repositoryApi.openIssue(proposal)
    : githubCli.openIssue({ ...proposal, attachments });
};

export { openIssue, type IssueOpening };
