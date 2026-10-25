import { fail, succeed, type Result } from "../../domain/result.ts";
import type { TextFileReader } from "../../infrastructure/text-file-reader.ts";

type BodyFailure =
  | { readonly kind: "body-missing" }
  | { readonly kind: "body-given-twice" }
  | { readonly kind: "body-file-unreadable"; readonly location: string };

type BodySources = {
  readonly inlineBody: string | undefined;
  readonly bodyFile: string | undefined;
  readonly readTextFile: TextFileReader;
};

const readOptionalBody = async ({
  inlineBody,
  bodyFile,
  readTextFile,
}: BodySources): Promise<Result<string | undefined, BodyFailure>> => {
  if (inlineBody !== undefined && bodyFile !== undefined) return fail({ kind: "body-given-twice" });
  if (bodyFile === undefined) return succeed(inlineBody);
  const fileBody = await readTextFile(bodyFile);
  if (fileBody.kind === "failure") {
    return fail({ kind: "body-file-unreadable", location: fileBody.reason.location });
  }
  return fileBody;
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
