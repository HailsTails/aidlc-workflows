import type { AgentRole } from "../domain/agent-role.ts";
import { withProvenance } from "../domain/provenance.ts";
import type { Result } from "../domain/result.ts";
import type { GitHubFailure } from "./github-failure.ts";
import type { GitHubRepositoryPort, PublishedLink } from "./github-repository-port.ts";

const NEW_ISSUE_SESSION = "new-issue";

type IssueOpening = {
  readonly repositoryApi: GitHubRepositoryPort;
  readonly role: AgentRole;
  readonly title: string;
  readonly authoredBody: string;
  readonly labels: readonly string[];
  readonly session: string | undefined;
};

const openIssue = ({
  repositoryApi,
  role,
  title,
  authoredBody,
  labels,
  session,
}: IssueOpening): Promise<Result<PublishedLink, GitHubFailure>> =>
  repositoryApi.openIssue({
    title,
    body: withProvenance({
      provenance: { role, session: session ?? NEW_ISSUE_SESSION },
      authoredBody,
    }),
    labels,
  });

export { openIssue, type IssueOpening };
