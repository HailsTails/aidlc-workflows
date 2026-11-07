import { z } from "zod";
import type { GitCredentialQuery } from "../../application/issue-git-credential.ts";
import { fail, succeed, type Result } from "../../domain/result.ts";
import type { CommandLineFailure } from "./cli-failure.ts";

const credentialQuerySchema = z.object({
  protocol: z.string(),
  host: z.string(),
  path: z.string().optional(),
});

const attributeOf = (line: string): readonly [string, string] => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
};

const parseCredentialQuery = (
  credentialInput: string,
): Result<GitCredentialQuery, CommandLineFailure> => {
  const attributes = Object.fromEntries(
    credentialInput
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map(attributeOf),
  );
  const query = credentialQuerySchema.safeParse(attributes);
  if (!query.success) {
    return fail({ kind: "credential-query-invalid", issues: query.error.message });
  }
  return succeed({ protocol: query.data.protocol, host: query.data.host, path: query.data.path });
};

export { parseCredentialQuery };
