import { z } from "zod";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

export type CheckArguments = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
};

export type ProjectArguments = {
  readonly repo: string;
};

const REPO_OPTION = "--repo";
const BASE_REVISION_OPTION = "--base-revision";

const optionPairs = (request: { readonly arguments: readonly string[] }): readonly unknown[] =>
  Array.from({ length: Math.ceil(request.arguments.length / 2) }, (_, index) => [
    request.arguments[index * 2],
    request.arguments[index * 2 + 1],
  ]);

const optionsSchema = (request: { readonly options: readonly [string, ...string[]] }) =>
  z
    .array(z.tuple([z.enum(request.options), z.string()]))
    .refine((pairs) => new Set(pairs.map(([option]) => option)).size === pairs.length, {
      error: "an option is given more than once",
    })
    .transform((pairs) => Object.fromEntries(pairs));

const checkArgumentsSchema = optionsSchema({ options: [REPO_OPTION, BASE_REVISION_OPTION] })
  .pipe(z.strictObject({ [REPO_OPTION]: z.string(), [BASE_REVISION_OPTION]: z.string().optional() }))
  .transform(
    (options): CheckArguments => ({
      repo: options[REPO_OPTION],
      baseRevision: options[BASE_REVISION_OPTION],
    }),
  );

const projectArgumentsSchema = optionsSchema({ options: [REPO_OPTION] })
  .pipe(z.strictObject({ [REPO_OPTION]: z.string() }))
  .transform((options): ProjectArguments => ({ repo: options[REPO_OPTION] }));

const parsedArguments = <Parsed>(request: {
  readonly schema: z.ZodType<Parsed>;
  readonly arguments: readonly string[];
}): Result<Parsed, LoadFailure> => {
  const parsed = request.schema.safeParse(optionPairs(request));
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: { kind: "arguments-invalid", detail: z.prettifyError(parsed.error) } };
};

export const parseCheckArguments = (request: {
  readonly arguments: readonly string[];
}): Result<CheckArguments, LoadFailure> =>
  parsedArguments({ schema: checkArgumentsSchema, arguments: request.arguments });

export const parseProjectArguments = (request: {
  readonly arguments: readonly string[];
}): Result<ProjectArguments, LoadFailure> =>
  parsedArguments({ schema: projectArgumentsSchema, arguments: request.arguments });
