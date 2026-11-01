import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import { formatRepositorySlug, type RepositorySlug } from "../domain/repository-slug.ts";
import { succeed, type Result } from "../domain/result.ts";
import { executeGraphql, type GraphqlConnection } from "./github-graphql.ts";

const GITHUB_NOT_FOUND_STATUS = 404;

type RepositoryConnection = GraphqlConnection & { readonly repository: RepositorySlug };

type RepositoryScope = { readonly connection: RepositoryConnection };

type Located<Request> = RepositoryScope & Request;

type MissingSubject = Located<{ readonly operation: string; readonly subject: string }>;

const linkSchema = z.object({ url: z.string() });

const missingSubject = ({ connection, operation, subject }: MissingSubject): GitHubFailure => ({
  kind: "github-rejected",
  operation,
  status: GITHUB_NOT_FOUND_STATUS,
  detail: `${subject} does not exist in ${formatRepositorySlug(connection.repository)}`,
});

const readRepositoryId = async ({
  connection,
}: RepositoryScope): Promise<Result<string, GitHubFailure>> => {
  const found = await executeGraphql({
    ...connection,
    operation: "read repository",
    query: `query RepositoryId($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id }
    }`,
    variables: { ...connection.repository },
    dataSchema: z.object({ repository: z.object({ id: z.string() }) }),
  });
  if (found.kind === "failure") return found;
  return succeed(found.outcome.repository.id);
};

export {
  linkSchema,
  missingSubject,
  readRepositoryId,
  type Located,
  type RepositoryConnection,
  type RepositoryScope,
};
