import type { ProjectionWrite } from "../mechanism-port/runner-result-schema.ts";
import type { Result } from "../values/result.ts";
import type { LoadFailure } from "./load-failure.ts";
import { projectMechanism } from "./mechanism-dispatch.ts";
import { allOk, type CheckRequest, loadInputs, recordsOf, runnerFailed } from "./run-check.ts";

export type ProjectRequest = Omit<CheckRequest, "baseRevision">;

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
        projectMechanism({
          runner: loaded.runner,
          request: {
            repoRoot: request.repoRoot,
            installRoot: request.installRoot,
            clauses: loaded.clauses,
            records: recordsOf({ records: inputs.value.records, mechanism: loaded.mechanism }),
          },
        }).then((runnerResult) => runnerFailed({ mechanism: loaded.mechanism, runnerResult })),
      ),
    ),
  });
  if (writes.outcome === "failed") {
    return writes;
  }
  return { outcome: "ok", value: writes.value.flat() };
};
