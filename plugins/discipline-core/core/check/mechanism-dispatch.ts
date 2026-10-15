import { z } from "zod";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import {
  type RunnerFailure,
  rejectedCall,
  runnerInvalidOutput,
} from "../mechanism-port/runner-failure.ts";
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
  }
};

export const projectMechanism = (
  request: MechanismProjectionRequest,
): Promise<Result<readonly ProjectionWrite[], RunnerFailure>> => {
  switch (request.runner.exceptionPath) {
    case "standalone": {
      return Promise.resolve({ outcome: "ok", value: [] });
    }
  }
};
