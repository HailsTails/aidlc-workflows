import { z } from "zod";
import { embeddedRunReportSchema } from "../mechanism-port/embedded-run-report-schema.ts";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../mechanism-port/runner-failure.ts";
import type {
  LoadedRunner,
  ProjectionRequest,
  RunRequest,
} from "../mechanism-port/runner-module-schema.ts";
import {
  type Hit,
  type ClauseEvaluation,
  type MechanismObservations,
  mechanismObservationsSchema,
  type NativeException,
  type ProjectionState,
  type ProjectionWrite,
  runnerResultSchema,
} from "../mechanism-port/runner-result-schema.ts";
import { projectionWriteSchema } from "../mechanism-port/runner-result-schema.ts";
import { clauseAddressText, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { Result } from "../values/result.ts";

export type MechanismRun = {
  readonly mechanism: MechanismId;
  readonly hits: readonly Hit[];
  readonly evaluated: readonly ClauseEvaluation[];
  readonly nativeExceptions: readonly NativeException[];
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly projection: "none" | ProjectionState;
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

const observationsResultSchema = runnerResultSchema({ value: mechanismObservationsSchema });

const unrequestedHit = (request: {
  readonly hits: readonly Hit[];
  readonly evaluated: readonly ClauseEvaluation[];
  readonly run: RunRequest;
}): Hit | undefined =>
  request.hits.find(
    (hit) =>
      !request.evaluated.some(
        (evaluation) => sameClauseAddress({ left: evaluation.clause, right: hit.clause }) === "same" &&
          evaluation.files.includes(hit.file),
      ),
  );

const observationsProblem = (request: {
  readonly observations: MechanismObservations;
  readonly run: RunRequest;
  readonly measurement: "measured" | "unmeasured";
}): string | undefined => {
  const foreign = request.observations.evaluated.find((evaluation) =>
    !request.run.clauses.some((clause) =>
      sameClauseAddress({ left: clause.address, right: evaluation.clause }) === "same",
    ),
  );
  if (foreign !== undefined) {
    return `an evaluation names ${clauseAddressText({ address: foreign.clause })}, which the request did not hold`;
  }
  if (request.measurement === "unmeasured" && request.observations.evaluated.length !== 0) {
    return "an unavailable mechanism returned evaluated clauses";
  }
  if (request.measurement === "measured") {
    const incomplete = request.run.clauses.find((clause) =>
      request.observations.evaluated.filter((evaluation) =>
        sameClauseAddress({ left: clause.address, right: evaluation.clause }) === "same",
      ).length !== 1,
    );
    if (incomplete !== undefined) {
      return `the requested clause ${clauseAddressText({ address: incomplete.address })} has no single evaluation`;
    }
  }
  const unrequested = unrequestedHit({ ...request.observations, run: request.run });
  return unrequested === undefined
    ? undefined
    : `a hit names ${clauseAddressText({ address: unrequested.clause })} in ${unrequested.file}, which the request did not hold`;
};

const standaloneRun = (request: {
  readonly returned: unknown;
  readonly mechanism: MechanismId;
  readonly run: RunRequest;
}): Result<MechanismRun, RunnerFailure> => {
  const parsed = observationsResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return runnerInvalidOutput({ detail: z.prettifyError(parsed.error) });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  const problem = observationsProblem({ observations: parsed.data.value, run: request.run, measurement: "measured" });
  if (problem !== undefined) return runnerInvalidOutput({ detail: problem });
  return {
    outcome: "ok",
    value: {
      mechanism: request.mechanism,
      hits: parsed.data.value.hits,
      evaluated: parsed.data.value.evaluated,
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
  const problem = observationsProblem({
    observations: report,
    run: request.run,
    measurement: report.projection === "missing" || report.projection === "not-included" ? "unmeasured" : "measured",
  });
  if (problem !== undefined) return runnerInvalidOutput({ detail: problem });
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
      evaluated: report.evaluated,
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
