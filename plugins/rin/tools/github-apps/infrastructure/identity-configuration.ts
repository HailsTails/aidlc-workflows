import { z } from "zod";
import type { RepositorySlug } from "../domain/repository-slug.ts";
import { fail, succeed, type Result } from "../domain/result.ts";
import { parseJsonText } from "./json-text.ts";
import type { TextFileReader } from "./text-file-reader.ts";

const roleAppSchema = z.object({ appSlug: z.string().min(1) });

const identityConfigurationSchema = z.object({
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .transform((slug): RepositorySlug => {
      const [owner = "", name = ""] = slug.split("/");
      return { owner, name };
    }),
  baseBranch: z.string().min(1),
  roles: z.object({ author: roleAppSchema, reviewer: roleAppSchema }),
});

type IdentityConfiguration = z.infer<typeof identityConfigurationSchema>;

type ConfigurationFailure =
  | { readonly kind: "configuration-unreadable"; readonly location: string }
  | { readonly kind: "configuration-invalid"; readonly location: string; readonly issues: string };

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

export { loadIdentityConfiguration, type ConfigurationFailure, type IdentityConfiguration };
