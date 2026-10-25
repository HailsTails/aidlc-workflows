import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

type IssueCommentRequest = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly issueNumber: number;
  readonly authoredBody: string;
  readonly session: string | undefined;
};

const commentOnIssue = ({
  repositoryApi,
  role,
  issueNumber,
  authoredBody,
  session,
}: IssueCommentRequest): Promise<Result<PublishedLink, GitHubFailure>> =>
  repositoryApi.commentOnIssue({
    issueNumber,
    body: withProvenance({
      provenance: { role, session: session ?? String(issueNumber) },
      authoredBody,
    }),
  });

export { commentOnIssue, type IssueCommentRequest };
