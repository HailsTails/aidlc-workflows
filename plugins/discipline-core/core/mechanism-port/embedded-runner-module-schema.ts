import type { z } from "zod";
import type { ProjectionRequest } from "../check/mechanism-dispatch.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import type { EmbeddedRunReport } from "./embedded-run-report-schema.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type {
  embeddedRunnerModuleSchema,
  RunRequest,
  StandaloneRunner,
} from "./runner-module-schema.ts";
import type { NativeException, ProjectionWrite } from "./runner-result-schema.ts";

export type EmbeddedRunner = {
  readonly exceptionPath: "embedded";
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: (
    request: RunRequest & { readonly records: readonly ExceptionRecord[] },
  ) => Promise<Result<EmbeddedRunReport, RunnerFailure>>;
  readonly conform: StandaloneRunner["conform"];
  readonly project: (
    request: ProjectionRequest,
  ) => Promise<Result<ProjectionWrite, RunnerFailure>>;
};

export const isEmbeddedKeySetEqual: Equal<
  keyof EmbeddedRunner,
  keyof z.output<typeof embeddedRunnerModuleSchema>
> = true;

export const isEmbeddedExceptionPathEqual: Equal<
  EmbeddedRunner["exceptionPath"],
  z.output<typeof embeddedRunnerModuleSchema>["exceptionPath"]
> = true;
