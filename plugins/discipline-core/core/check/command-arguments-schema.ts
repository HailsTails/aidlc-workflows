import { z } from "zod";
import { type ReportOutput, reportOutputSchema } from "../values/report-output.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";

export type CheckArguments = {
  readonly repo: string;
  readonly baseRevision: string | undefined;
  readonly reportOutput: ReportOutput | undefined;
};

export type ProjectArguments = {
  readonly repo: string;
};

const REPO_OPTION = "--repo";
const BASE_REVISION_OPTION = "--base-revision";
const REPORT_OUTPUT_OPTION = "--report-output";

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

const checkArgumentsSchema = optionsSchema({ options: [REPO_OPTION, BASE_REVISION_OPTION, REPORT_OUTPUT_OPTION] })
  .pipe(
    z.strictObject({
      [REPO_OPTION]: z.string(),
      [BASE_REVISION_OPTION]: z.string().optional(),
      [REPORT_OUTPUT_OPTION]: reportOutputSchema.optional(),
    }),
  )
  .transform(
    (options): CheckArguments => ({
      repo: options[REPO_OPTION],
      baseRevision: options[BASE_REVISION_OPTION],
      reportOutput: options[REPORT_OUTPUT_OPTION],
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
  if (!parsed.success) {
    return { outcome: "failed", error: { kind: "arguments-invalid", detail: z.prettifyError(parsed.error) } };
  }
  return { outcome: "ok", value: parsed.data };
};

export const parseCheckArguments = (request: {
  readonly arguments: readonly string[];
}): Result<CheckArguments, LoadFailure> =>
  parsedArguments({ schema: checkArgumentsSchema, arguments: request.arguments });

export const parseProjectArguments = (request: {
  readonly arguments: readonly string[];
}): Result<ProjectArguments, LoadFailure> =>
  parsedArguments({ schema: projectArgumentsSchema, arguments: request.arguments });
