import type { BodySource } from "../domain/gh-invocation.ts";
import { assessPublishability, type Publishability } from "../domain/publishable-text.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import type { BodyFileFailure, BodyFileReader } from "./read-body-file.ts";

type UnpublishableReason = Exclude<Publishability, "publishable">;

type AuthoredBodyFailure =
  | { readonly kind: "inline-body-refused"; readonly reason: UnpublishableReason }
  | BodyFileFailure;

type AuthoredBodySources = {
  readonly readBodyFile: BodyFileReader;
  readonly readStandardInput: () => Promise<string>;
};

type AuthoredBodyRead = AuthoredBodySources & { readonly source: BodySource | undefined };

const refuseUnpublishable = (text: string): Result<string, AuthoredBodyFailure> => {
  const publishability = assessPublishability(text);
  return publishability === "publishable"
    ? succeed(text)
    : fail({ kind: "inline-body-refused", reason: publishability });
};

const readAuthoredBody = async ({
  source,
  readBodyFile,
  readStandardInput,
}: AuthoredBodyRead): Promise<Result<string | undefined, AuthoredBodyFailure>> => {
  if (source === undefined) return succeed(undefined);
  switch (source.kind) {
    case "inline":
      return refuseUnpublishable(source.text);
    case "standard-input":
      return refuseUnpublishable(await readStandardInput());
    case "file":
      return readBodyFile(source.location);
  }
};

export { readAuthoredBody, refuseUnpublishable, type AuthoredBodyFailure, type AuthoredBodySources };
