import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type ProjectionRequest, projectMechanism } from "./mechanism-dispatch.ts";
import {
  allOk,
  type CheckRequest,
  type LoadedMechanism,
  loadInputs,
  recordsOf,
  runnerFailed,
} from "./run-check.ts";

export type ProjectRequest = Omit<CheckRequest, "baseRevision">;

const projectionRequestOf = (request: {
  readonly project: ProjectRequest;
  readonly records: readonly ExceptionRecord[];
  readonly loaded: LoadedMechanism;
}): ProjectionRequest => ({
  repoRoot: request.project.repoRoot,
  installRoot: request.project.installRoot,
  clauses: request.loaded.clauses,
  records: recordsOf({ records: request.records, mechanism: request.loaded.mechanism }),
});

const projectionWritesOf = (request: {
  readonly project: ProjectRequest;
  readonly records: readonly ExceptionRecord[];
  readonly loaded: LoadedMechanism;
}): Promise<Result<readonly ProjectionWrite[], LoadFailure>> =>
  projectMechanism({ runner: request.loaded.runner, request: projectionRequestOf(request) }).then(
    (runnerResult) => runnerFailed({ mechanism: request.loaded.mechanism, runnerResult }),
  );

export const runProject = async (
  request: ProjectRequest,
): Promise<Result<readonly ProjectionWrite[], LoadFailure>> => {
  const inputs = await loadInputs(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const writes = allOk({
    results: await Promise.all(
      inputs.value.mechanisms.map((loaded) =>
        projectionWritesOf({ project: request, records: inputs.value.records, loaded }),
      ),
    ),
  });
  if (writes.outcome === "failed") {
    return writes;
  }
  return { outcome: "ok", value: writes.value.flat() };
};
