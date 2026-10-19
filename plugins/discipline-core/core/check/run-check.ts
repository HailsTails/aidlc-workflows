import { z } from "zod";
import type { SelectionRepository } from "../consumer-selection/consumer-selection.ts";
import type { ClauseBinding, Selection } from "../consumer-selection/selection.ts";
import type {
  ExceptionRepository,
  ExceptionRecord,
  InvalidRecord,
} from "../exception-records/exception-records.ts";
import { applyGovernance, type Finding } from "../governance/governance.ts";
import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import {
  type LoadedRunner,
  type LocationScope,
  type RunnerClause,
  type RunRequest,
  runnerModuleSchema,
} from "../mechanism-port/runner-module-schema.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { computeTouchedSet, type TouchedSet } from "../touched-set/touched-set.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type ClauseAddress, clauseAddressText, sameClauseAddress } from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport, ClauseCoverage, ProjectionProblem, Unmeasured } from "../verdict/check-report.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type MechanismRun, runMechanism } from "./mechanism-dispatch.ts";

export type CheckScope = {
  readonly clauses?: readonly ClauseAddress[];
  readonly includes?: LocationScope;
};

export type CheckRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly selections: SelectionRepository;
  readonly exceptions: ExceptionRepository;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly git: GitPort;
  readonly scope?: CheckScope;
};

export type LoadRequest = Omit<CheckRequest, "baseRevision" | "git">;

export type LoadedMechanism = {
  readonly mechanism: MechanismId;
  readonly runner: LoadedRunner;
  readonly clauses: readonly RunnerClause[];
};

export type LoadedInputs = {
  readonly selection: Selection;
  readonly records: readonly ExceptionRecord[];
  readonly invalidRecords: readonly InvalidRecord[];
  readonly mechanisms: readonly LoadedMechanism[];
};

const runnerExportSchema = z.object({ runner: runnerModuleSchema });

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error,
});

export const allOk = <Value>(request: {
  readonly results: readonly Result<Value, LoadFailure>[];
}): Result<readonly Value[], LoadFailure> => {
  const [firstFailure] = request.results.flatMap((loadResult) =>
    loadResult.outcome === "failed" ? [loadResult.error] : [],
  );
  if (firstFailure !== undefined) {
    return failed(firstFailure);
  }
  return {
    outcome: "ok",
    value: request.results.flatMap((loadResult) => (loadResult.outcome === "ok" ? [loadResult.value] : [])),
  };
};

export const runnerFailed = <Value>(request: {
  readonly mechanism: MechanismId;
  readonly runnerResult: Result<Value, RunnerFailure>;
}): Result<Value, LoadFailure> =>
  request.runnerResult.outcome === "failed"
    ? failed({ kind: "runner-failed", mechanism: request.mechanism, failure: request.runnerResult.error })
    : request.runnerResult;

const loadRunner = async (
  request: LoadRequest & { readonly mechanism: MechanismId },
): Promise<Result<LoadedRunner, LoadFailure>> => {
  const loaded = await request.modules.load({
    path: request.path.join({
      segments: [request.installRoot, "mechanisms", request.mechanism, "runner", "runner.ts"],
    }),
  });
  if (loaded.outcome === "failed") {
    return failed({ kind: "runner-invalid", mechanism: request.mechanism, detail: loaded.error.detail });
  }
  const parsed = runnerExportSchema.safeParse(loaded.value);
  if (!parsed.success) {
    return failed({ kind: "runner-invalid", mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
  }
  return { outcome: "ok", value: parsed.data.runner };
};

const distinctMechanisms = (request: { readonly bindings: readonly ClauseBinding[] }): readonly MechanismId[] => [
  ...new Set(request.bindings.map((binding) => binding.mechanism)),
];

const clausesOf = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly mechanism: MechanismId;
}): readonly RunnerClause[] =>
  request.bindings.filter((binding) => binding.mechanism === request.mechanism).map((binding) => binding.clause);

const loadedMechanism = (request: {
  readonly bindings: readonly ClauseBinding[];
  readonly mechanism: MechanismId;
  readonly runner: Result<LoadedRunner, LoadFailure>;
}): Result<LoadedMechanism, LoadFailure> => {
  if (request.runner.outcome === "failed") {
    return request.runner;
  }
  return {
    outcome: "ok",
    value: { mechanism: request.mechanism, runner: request.runner.value, clauses: clausesOf(request) },
  };
};

const loadMechanisms = async (
  request: LoadRequest & { readonly bindings: readonly ClauseBinding[] },
): Promise<Result<readonly LoadedMechanism[], LoadFailure>> =>
  allOk({
    results: await Promise.all(
      distinctMechanisms(request).map((mechanism) =>
        loadRunner({ ...request, mechanism }).then((runner) =>
          loadedMechanism({ bindings: request.bindings, mechanism, runner }),
        ),
      ),
    ),
  });

export const loadInputs = async (request: LoadRequest): Promise<Result<LoadedInputs, LoadFailure>> => {
  const reading = request.selections.read({});
  if (reading.outcome === "failed") {
    return reading;
  }
  const exceptions = request.exceptions.read({ selection: reading.value.selection });
  if (exceptions.outcome === "failed") {
    return exceptions;
  }
  const unadopted = request.scope?.clauses?.find((clause) =>
    !reading.value.selection.selected.some((selected) =>
      sameClauseAddress({ left: selected.address, right: clause }) === "same",
    ),
  );
  if (unadopted !== undefined) {
    return failed({
      kind: "arguments-invalid",
      detail: `the requested clause ${clauseAddressText({ address: unadopted })} is not adopted`,
    });
  }
  const bindings = reading.value.bindings.filter((binding) =>
    clauseRequest({ clause: binding.clause.address, scope: request.scope }) === "requested",
  );
  const mechanisms = await loadMechanisms({ ...request, bindings });
  if (mechanisms.outcome === "failed") {
    return mechanisms;
  }
  return {
    outcome: "ok",
    value: {
      selection: reading.value.selection,
      records: exceptions.value.records,
      invalidRecords: exceptions.value.invalid,
      mechanisms: mechanisms.value,
    },
  };
};

export const recordsOf = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly mechanism: MechanismId;
}): readonly ExceptionRecord[] =>
  request.records.filter((record) => record.mechanism === request.mechanism);

const forfeitureUnmeasured = (request: {
  readonly touched: TouchedSet;
  readonly records: readonly ExceptionRecord[];
}): readonly Unmeasured[] =>
  request.touched.measured === "no" && request.records.some((record) => record.kind === "file-carve-out")
    ? [{ kind: "forfeiture-unmeasured" }]
    : [];

const projectionOutcome = (request: {
  readonly run: MechanismRun;
}): { readonly unmeasured: readonly Unmeasured[]; readonly problems: readonly ProjectionProblem[] } => {
  switch (request.run.projection) {
    case "none":
    case "current":
      return { unmeasured: [], problems: [] };
    case "missing":
    case "not-included":
      return {
        unmeasured: [
          { kind: "mechanism-not-run", mechanism: request.run.mechanism, projection: request.run.projection },
        ],
        problems: [],
      };
    case "out-of-date":
      return { unmeasured: [], problems: [{ mechanism: request.run.mechanism, state: request.run.projection }] };
  }
};

const trackedPathsOf = (request: CheckRequest): Result<readonly RepoPath[], LoadFailure> => {
  const tracked = request.git.trackedPaths({ repoRoot: request.repoRoot });
  if (tracked.outcome === "failed") {
    return failed({ kind: "git-failed", detail: `${tracked.error.command}: ${tracked.error.detail}` });
  }
  return tracked;
};

const runRequestOf = (request: {
  readonly check: CheckRequest;
  readonly tracked: readonly RepoPath[];
  readonly loaded: LoadedMechanism;
}): RunRequest => ({
  repoRoot: request.check.repoRoot,
  installRoot: request.check.installRoot,
  trackedPaths: request.tracked,
  clauses: request.loaded.clauses,
  ...(request.check.scope?.includes === undefined ? {} : { includes: request.check.scope.includes }),
});

const mechanismRunOf = (request: {
  readonly check: CheckRequest;
  readonly tracked: readonly RepoPath[];
  readonly records: readonly ExceptionRecord[];
  readonly loaded: LoadedMechanism;
}): Promise<Result<MechanismRun, LoadFailure>> =>
  runMechanism({
    runner: request.loaded.runner,
    mechanism: request.loaded.mechanism,
    run: runRequestOf(request),
    records: recordsOf({ records: request.records, mechanism: request.loaded.mechanism }),
  }).then((runnerResult) => runnerFailed({ mechanism: request.loaded.mechanism, runnerResult }));

const mechanismRuns = async (request: {
  readonly check: CheckRequest;
  readonly tracked: readonly RepoPath[];
  readonly inputs: LoadedInputs;
}): Promise<Result<readonly MechanismRun[], LoadFailure>> =>
  allOk({
    results: await Promise.all(
      request.inputs.mechanisms.map((loaded) =>
        mechanismRunOf({ check: request.check, tracked: request.tracked, records: request.inputs.records, loaded }),
      ),
    ),
  });

const findingsOf = (request: { readonly runs: readonly MechanismRun[] }): readonly Finding[] =>
  request.runs.flatMap((run) => run.hits.map((hit) => ({ ...hit, mechanism: run.mechanism })));

const clauseRequest = (request: {
  readonly clause: ClauseAddress;
  readonly scope: CheckScope | undefined;
}): "requested" | "not-requested" =>
  request.scope?.clauses === undefined || request.scope.clauses.some((clause) =>
    sameClauseAddress({ left: clause, right: request.clause }) === "same",
  ) ? "requested" : "not-requested";

const staleCandidatesOf = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly scope: CheckScope | undefined;
}): readonly ExceptionRecord[] =>
  request.records.filter((record) =>
    clauseRequest({ clause: record.clause, scope: request.scope }) === "requested" &&
    (record.kind === "clause-wide-carve-out" ||
      request.scope?.includes?.({ clause: record.clause, file: record.file }) !== "excluded"),
  );

const coverageOf = (request: {
  readonly selection: Selection;
  readonly scope: CheckScope | undefined;
  readonly runs: readonly MechanismRun[];
}): readonly ClauseCoverage[] =>
  request.selection.selected.flatMap((selected): readonly ClauseCoverage[] => {
    const binding = { clause: selected.address, mechanism: selected.mechanism };
    if (clauseRequest({ clause: selected.address, scope: request.scope }) === "not-requested") {
      return [{ ...binding, evaluation: "not-requested", scannedCount: 0 }];
    }
    const evaluated = request.runs.find((run) => run.mechanism === selected.mechanism)?.evaluated.find((entry) =>
      sameClauseAddress({ left: entry.clause, right: selected.address }) === "same",
    );
    if (evaluated === undefined) {
      return [];
    }
    const scannedCount = new Set(evaluated.files).size;
    return [{ ...binding, evaluation: scannedCount === 0 ? "not-applicable" : "evaluated", scannedCount }];
  });

const checkReportOf = (request: {
  readonly inputs: LoadedInputs;
  readonly runs: readonly MechanismRun[];
  readonly touched: TouchedSet;
  readonly scope: CheckScope | undefined;
}): CheckReport => {
  const governed = applyGovernance({
    findings: findingsOf(request),
    records: request.inputs.records,
    staleCandidates: staleCandidatesOf({ records: request.inputs.records, scope: request.scope }),
    touched: request.touched,
    runs: request.runs,
  });
  const projections = request.runs.map((run) => projectionOutcome({ run }));
  return {
    ...governed,
    coverage: coverageOf({ selection: request.inputs.selection, scope: request.scope, runs: request.runs }),
    uncovered: request.inputs.selection.uncovered,
    invalidRecords: request.inputs.invalidRecords,
    unmeasured: [
      ...forfeitureUnmeasured({ touched: request.touched, records: request.inputs.records }),
      ...projections.flatMap((projection) => projection.unmeasured),
    ],
    projectionProblems: projections.flatMap((projection) => projection.problems),
  };
};

export const runCheck = async (request: CheckRequest): Promise<Result<CheckReport, LoadFailure>> => {
  const inputs = await loadInputs(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tracked = trackedPathsOf(request);
  if (tracked.outcome === "failed") {
    return tracked;
  }
  const runs = await mechanismRuns({ check: request, tracked: tracked.value, inputs: inputs.value });
  if (runs.outcome === "failed") {
    return runs;
  }
  return {
    outcome: "ok",
    value: checkReportOf({ inputs: inputs.value, runs: runs.value, touched: computeTouchedSet(request), scope: request.scope }),
  };
};
