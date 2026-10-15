import { z } from "zod";
import { embeddedRunReportSchema } from "../mechanism-port/embedded-run-report-schema.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import type {
  LoadedRunner,
  RunnerClause,
  RunRequest,
} from "../mechanism-port/runner-module-schema.ts";
import {
  type Hit,
  hitSchema,
  type NativeException,
  type ProjectionState,
  type ProjectionWrite,
  runnerResultSchema,
} from "../mechanism-port/runner-result-schema.ts";
import { projectionWriteSchema } from "../mechanism-port/runner-result-schema.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { clauseAddressText, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { Result } from "../values/result.ts";

export type MechanismRun = {
  readonly mechanism: MechanismId;
  readonly hits: readonly Hit[];
  readonly nativeExceptions: readonly NativeException[];
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly projection: "none" | ProjectionState;
};

export type ProjectionRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
};

export type MechanismRequest = {
  readonly runner: LoadedRunner;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
  readonly records: readonly ExceptionRecord[];
};

export type MechanismProjectionRequest = {
  readonly runner: LoadedRunner;
  readonly request: ProjectionRequest;
};

const hitsResultSchema = runnerResultSchema({ value: z.array(hitSchema).readonly() });

export const runnerInvalidOutput = (request: {
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "runner-invalid-output", detail: request.detail },
});

export const rejectedCall = (request: {
  readonly thrown: unknown;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } =>
  runnerInvalidOutput({
    detail: `the runner call threw or rejected: ${request.thrown instanceof Error ? request.thrown.message : String(request.thrown)}`,
  });

const unrequestedHit = (request: {
  readonly hits: readonly Hit[];
  readonly run: RunRequest;
}): Hit | undefined =>
  request.hits.find(
    (hit) =>
      !request.run.files.includes(hit.file) ||
      !request.run.clauses.some(
        (clause) => sameClauseAddress({ left: clause.address, right: hit.clause }) === "same",
      ),
  );

const standaloneRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = hitsResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const unrequested = unrequestedHit({ hits: parsed.data.value, run: request.run });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({
      detail: `a hit names ${clauseAddressText({ address: unrequested.clause })} in ${unrequested.file}, which the request did not hold`,
    });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: parsed.data.value,
      nativeExceptions: [],
      projectedKinds: [],
      projection: "none",
    },
  };
};

const reportResultSchema = runnerResultSchema({ value: embeddedRunReportSchema });

const projectionWriteResultSchema = runnerResultSchema({ value: projectionWriteSchema });

const unrequestedNativeException = (request: {
  readonly nativeExceptions: readonly NativeException[];
  readonly run: RunRequest;
}): NativeException | undefined =>
  request.nativeExceptions.find(
    (nativeException) =>
      !request.run.clauses.some(
        (clause) =>
          sameClauseAddress({ left: clause.address, right: nativeException.clause }) === "same",
      ),
  );

const embeddedRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = reportResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const report = parsed.data.value;
  const unrequested = unrequestedHit({ hits: report.hits, run: request.run });
  if (unrequested !== undefined) {
    return runnerInvalidOutput({
      detail: `a hit names ${clauseAddressText({ address: unrequested.clause })} in ${unrequested.file}, which the request did not hold`,
    });
  }
  const unrequestedNative = unrequestedNativeException({
    nativeExceptions: report.nativeExceptions,
    run: request.run,
  });
  if (unrequestedNative !== undefined) {
    return runnerInvalidOutput({
      detail: `a native exception names ${clauseAddressText({ address: unrequestedNative.clause })}, which the request did not hold`,
    });
  }
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: report.hits,
      nativeExceptions: report.nativeExceptions,
      projectedKinds: request.projectedKinds,
      projection: report.projection,
    },
  };
};

const embeddedProjection = (request: {
  readonly returned: unknown;
}): Result<readonly ProjectionWrite[], RunnerFailure> => {
  const parsed = projectionWriteResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  return { outcome: "ok", value: [parsed.data.value] };
};

export const runMechanism = (
  request: MechanismRequest,
): Promise<Result<MechanismRun, RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.run(request.run))
        .then(
          (returned) => standaloneRun({ returned, mechanism: request.mechanism, run: request.run }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.run({ ...request.run, records: request.records }))
        .then(
          (returned) =>
            embeddedRun({
              returned,
              mechanism: request.mechanism,
              projectedKinds: runner.projectedKinds,
              run: request.run,
            }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};

export const projectMechanism = (
  request: MechanismProjectionRequest,
): Promise<Result<readonly ProjectionWrite[], RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      return Promise.resolve({ outcome: "ok", value: [] });
    }
    case "embedded": {
      const runner = request.runner;
      return Promise.resolve()
        .then(() => runner.project(request.request))
        .then(
          (returned) => embeddedProjection({ returned }),
          (thrown: unknown) => rejectedCall({ thrown }),
        );
    }
  }
};
