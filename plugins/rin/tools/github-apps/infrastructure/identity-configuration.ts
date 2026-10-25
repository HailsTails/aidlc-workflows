import { z } from "zod";
import type {
  ConfigurationFailure,
  IdentityConfiguration,
} from "../application/identity-configuration-port.ts";
import type { TextFileReader } from "../application/text-file-port.ts";
import type { RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { parseJsonText } from "./json-text.ts";

const REPOSITORY_SEGMENT = String.raw`(?!\.{1,2}(?:/|$))[\w.-]+`;

const roleAppSchema = z.object({ appSlug: z.string().min(1) });

const identityConfigurationSchema = z.object({
  repository: z
    .string()
    .regex(new RegExp(`^${REPOSITORY_SEGMENT}/${REPOSITORY_SEGMENT}$`))
    .transform((slug): RepositorySlug => {
      const [owner = "", name = ""] = slug.split("/");
      return { owner, name };
    }),
  baseBranch: z.string().min(1),
  roles: z.object({ author: roleAppSchema, reviewer: roleAppSchema }),
});

type ConfigurationSource = {
  readonly readTextFile: TextFileReader;
  readonly location: URL;
};

const loadIdentityConfiguration = async ({
  readTextFile,
  location,
}: ConfigurationSource): Promise<Result<IdentityConfiguration, ConfigurationFailure>> => {
  const configurationText = await readTextFile(location);
  if (configurationText.kind === "failure") {
    return fail({ kind: "configuration-unreadable", location: location.href });
  }
  const configurationJson = parseJsonText(configurationText.outcome);
  if (configurationJson.kind === "failure") {
    return fail({ kind: "configuration-invalid", location: location.href, issues: "not JSON" });
  }
  const parsed = identityConfigurationSchema.safeParse(configurationJson.outcome);
  if (!parsed.success) {
    return fail({
      kind: "configuration-invalid",
      location: location.href,
      issues: parsed.error.message,
    });
  }
  return succeed(parsed.data);
};

export { loadIdentityConfiguration };
