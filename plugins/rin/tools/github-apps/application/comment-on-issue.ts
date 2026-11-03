import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubCliFailure, GitHubCliPort } from "./github-cli-port.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type IssueCommentRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly githubCli: GitHubCliPort;
  readonly role: AgentRole;
  readonly issueNumber: number;
  readonly authoredBody: string;
  readonly attachments: readonly string[];
  readonly session: string | undefined;
};

const commentOnIssue = ({
  repositoryApi,
  githubCli,
  role,
  issueNumber,
  authoredBody,
  attachments,
  session,
}: IssueCommentRequest): Promise<Result<PublishedLink, GitHubFailure | GitHubCliFailure>> => {
  const comment = {
    issueNumber,
    body: withProvenance({
      provenance: { role, session: session ?? String(issueNumber) },
      authoredBody,
    }),
  };
  return attachments.length === 0
    ? repositoryApi.commentOnIssue(comment)
    : githubCli.commentOnIssue({ ...comment, attachments });
};

export { commentOnIssue, type IssueCommentRequest };
