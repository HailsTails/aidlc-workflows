import { z } from "zod";
import type { GitHubFailure } from "../application/github-failure.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";
import type { GitHubHttp } from "./github-http.ts";

const GITHUB_OK_STATUS = 200;

const graphqlEnvelopeSchema = z.object({
  data: z.unknown(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

type GraphqlConnection = { readonly http: GitHubHttp; readonly credential: Secret };

type GraphqlOperation<Data> = {
  readonly operation: string;
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly dataSchema: z.ZodType<Data>;
};

type GraphqlExecution<Data> = GraphqlConnection & GraphqlOperation<Data>;

const executeGraphql = async <Data>({
  http,
  credential,
  operation,
  query,
  variables,
  dataSchema,
}: GraphqlExecution<Data>): Promise<Result<Data, GitHubFailure>> => {
  const reply = await http.requestJson({
    operation,
    method: "POST",
    path: "/graphql",
    credential,
    requestBody: { query, variables },
  });
  if (reply.kind === "failure") return reply;
  const envelope = graphqlEnvelopeSchema.safeParse(reply.outcome);
  if (!envelope.success) {
    return fail({ kind: "github-response-invalid", operation, issues: envelope.error.message });
  }
  if (envelope.data.errors !== undefined && envelope.data.errors.length > 0) {
    return fail({
      kind: "github-rejected",
      operation,
      status: GITHUB_OK_STATUS,
      detail: envelope.data.errors.map(({ message }) => message).join("; "),
    });
  }
  const operationData = dataSchema.safeParse(envelope.data.data);
  if (!operationData.success) {
    return fail({
      kind: "github-response-invalid",
      operation,
      issues: operationData.error.message,
    });
  }
  return succeed(operationData.data);
};

export { executeGraphql, type GraphqlConnection, type GraphqlOperation };
