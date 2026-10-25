import type { BodyFileFailure, BodyFileReader } from "../../application/read-body-file.ts";
import { containsPrivateKey } from "../../domain/publishable-text.ts";
import { fail, succeed, type Result } from "../../domain/result.ts";

type BodyFailure =
  | { readonly kind: "body-missing" }
  | { readonly kind: "body-given-twice" }
  | { readonly kind: "inline-body-refused"; readonly reason: "contains-private-key" }
  | BodyFileFailure;

type BodySources = {
  readonly inlineBody: string | undefined;
  readonly bodyFile: string | undefined;
  readonly readBodyFile: BodyFileReader;
};

const readOptionalBody = async ({
  inlineBody,
  bodyFile,
  readBodyFile,
}: BodySources): Promise<Result<string | undefined, BodyFailure>> => {
  if (inlineBody !== undefined && bodyFile !== undefined) return fail({ kind: "body-given-twice" });
  if (inlineBody !== undefined && containsPrivateKey(inlineBody)) {
    return fail({ kind: "inline-body-refused", reason: "contains-private-key" });
  }
  if (bodyFile === undefined) return succeed(inlineBody);
  return readBodyFile(bodyFile);
};

const readRequiredBody = async (sources: BodySources): Promise<Result<string, BodyFailure>> => {
  const authoredBody = await readOptionalBody(sources);
  if (authoredBody.kind === "failure") return authoredBody;
  if (authoredBody.outcome === undefined || authoredBody.outcome.trim() === "") {
    return fail({ kind: "body-missing" });
  }
  return succeed(authoredBody.outcome);
};

export { readOptionalBody, readRequiredBody, type BodyFailure, type BodySources };
