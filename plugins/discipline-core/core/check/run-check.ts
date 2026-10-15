import { z } from "zod";
import {
  type SelectedClause,
  type Selection,
  readSelection,
  ruleSetRootOf,
} from "../consumer-selection/consumer-selection.ts";
import {
  type ExceptionRecord,
  type InvalidRecord,
  parseExceptionEntries,
  readExceptionEntries,
} from "../exception-records/exception-records.ts";
import { applyGovernance } from "../governance/governance.ts";
import type { RunnerFailure } from "../mechanism-port/runner-failure.ts";
import {
  type LoadedRunner,
  type RunnerClause,
  runnerModuleSchema,
} from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { GitPort } from "../platform-ports/git-port.ts";
import type { ModuleLoaderPort } from "../platform-ports/module-loader-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import {
  type ClauseDefinition,
  readDisciplineFile,
  readPieceFile,
  readVersionOneJson,
} from "../rule-set-reader/rule-set-reader.ts";
import { computeTouchedSet, type TouchedSet } from "../touched-set/touched-set.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { clauseAddressText } from "../values/clause-address.ts";
import { type MechanismId, ruleSetNameSchema } from "../values/identifiers.ts";
import type { Result } from "../values/result.ts";
import type { CheckReport, ProjectionProblem, Unmeasured } from "../verdict/check-report.ts";
import type { LoadFailure } from "./load-failure.ts";
import { type MechanismRun, runMechanism } from "./mechanism-dispatch.ts";

export type CheckRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly baseRevision: string | undefined;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly git: GitPort;
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

type MechanicalDefinition = Extract<ClauseDefinition, { readonly kind: "mechanical" }>;

type SelectedRunnerClause = {
  readonly mechanism: MechanismId;
  readonly clause: RunnerClause;
};

const TYPESCRIPT_FILE = /\.(?:ts|tsx|mts|cts)$/;

const ruleSetDirectoriesSchema = z.object({ ruleSets: z.record(ruleSetNameSchema, z.string()) });

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

const ruleSetDirectories = (
  request: LoadRequest,
): Result<Readonly<Record<string, string>>, LoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, "disciplines.json"] });
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = ruleSetDirectoriesSchema.safeParse(document.value);
  return parsed.success
    ? { outcome: "ok", value: parsed.data.ruleSets }
    : failed({ kind: "file-malformed", path, detail: z.prettifyError(parsed.error) });
};

const runnerClauseOf = (
  request: LoadRequest & {
    readonly directories: Readonly<Record<string, string>>;
    readonly selected: SelectedClause;
  },
): Result<SelectedRunnerClause, LoadFailure> => {
  const { address, mechanism } = request.selected;
  const ruleSetRoot = ruleSetRootOf({
    ruleSet: address.ruleSet,
    ruleSets: request.directories,
    repoRoot: request.repoRoot,
    installRoot: request.installRoot,
    path: request.path,
  });
  if (ruleSetRoot.outcome === "failed") {
    return ruleSetRoot;
  }
  const location = { fileText: request.fileText, path: request.path, ruleSetRoot: ruleSetRoot.value };
  const discipline = readDisciplineFile({ ...location, discipline: address.discipline });
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find(
    (candidate): candidate is MechanicalDefinition =>
      candidate.kind === "mechanical" && candidate.id === address.clause,
  );
  if (definition === undefined) {
    return failed({ kind: "unknown-clause", address: clauseAddressText({ address }) });
  }
  const piece = readPieceFile({ ...location, mechanism, discipline: discipline.value });
  if (piece.outcome === "failed") {
    return piece;
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === address.clause);
  if (entry === undefined) {
    return failed({ kind: "piece-missing", address: clauseAddressText({ address }), mechanism });
  }
  return {
    outcome: "ok",
    value: {
      mechanism,
      clause: {
        address,
        anchor: definition.anchor,
        pieceRoot: request.path.join({
          segments: [ruleSetRoot.value, "mechanisms", mechanism, address.discipline],
        }),
        settings: entry.settings,
      },
    },
  };
};

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
  return parsed.success
    ? { outcome: "ok", value: parsed.data.runner }
    : failed({ kind: "runner-invalid", mechanism: request.mechanism, detail: z.prettifyError(parsed.error) });
};

const loadMechanisms = async (
  request: LoadRequest & { readonly selected: readonly SelectedRunnerClause[] },
): Promise<Result<readonly LoadedMechanism[], LoadFailure>> => {
  const mechanisms = [...new Set(request.selected.map((selected) => selected.mechanism))];
  const loaded = await Promise.all(
    mechanisms.map((mechanism) =>
      loadRunner({ ...request, mechanism }).then(
        (runner): Result<LoadedMechanism, LoadFailure> =>
          runner.outcome === "failed"
            ? runner
            : {
                outcome: "ok",
                value: {
                  mechanism,
                  runner: runner.value,
                  clauses: request.selected
                    .filter((selected) => selected.mechanism === mechanism)
                    .map((selected) => selected.clause),
                },
              },
      ),
    ),
  );
  return allOk({ results: loaded });
};

export const loadInputs = async (request: LoadRequest): Promise<Result<LoadedInputs, LoadFailure>> => {
  const selection = readSelection(request);
  if (selection.outcome === "failed") {
    return selection;
  }
  const entries = readExceptionEntries(request);
  if (entries.outcome === "failed") {
    return entries;
  }
  const directories = ruleSetDirectories(request);
  if (directories.outcome === "failed") {
    return directories;
  }
  const selected = allOk({
    results: selection.value.selected.map((clause) =>
      runnerClauseOf({ ...request, directories: directories.value, selected: clause }),
    ),
  });
  if (selected.outcome === "failed") {
    return selected;
  }
  const mechanisms = await loadMechanisms({ ...request, selected: selected.value });
  if (mechanisms.outcome === "failed") {
    return mechanisms;
  }
  const parsed = parseExceptionEntries({ entries: entries.value, selection: selection.value });
  return {
    outcome: "ok",
    value: {
      selection: selection.value,
      records: parsed.records,
      invalidRecords: parsed.invalid,
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

export const runCheck = async (request: CheckRequest): Promise<Result<CheckReport, LoadFailure>> => {
  const inputs = await loadInputs(request);
  if (inputs.outcome === "failed") {
    return inputs;
  }
  const tracked = request.git.trackedPaths({ repoRoot: request.repoRoot });
  if (tracked.outcome === "failed") {
    return failed({ kind: "git-failed", detail: `${tracked.error.command}: ${tracked.error.detail}` });
  }
  const files = tracked.value.filter((trackedPath) => TYPESCRIPT_FILE.test(trackedPath));
  const runs = allOk({
    results: await Promise.all(
      inputs.value.mechanisms.map((loaded) =>
        runMechanism({
          runner: loaded.runner,
          mechanism: loaded.mechanism,
          run: {
            repoRoot: request.repoRoot,
            installRoot: request.installRoot,
            files,
            trackedPaths: tracked.value,
            clauses: loaded.clauses,
          },
          records: recordsOf({ records: inputs.value.records, mechanism: loaded.mechanism }),
        }).then((runnerResult) => runnerFailed({ mechanism: loaded.mechanism, runnerResult })),
      ),
    ),
  });
  if (runs.outcome === "failed") {
    return runs;
  }
  const touched = computeTouchedSet(request);
  const governed = applyGovernance({
    findings: runs.value.flatMap((run) => run.hits.map((hit) => ({ ...hit, mechanism: run.mechanism }))),
    records: inputs.value.records,
    touched,
    runs: runs.value,
  });
  const projections = runs.value.map((run) => projectionOutcome({ run }));
  return {
    outcome: "ok",
    value: {
      ...governed,
      uncovered: inputs.value.selection.uncovered,
      invalidRecords: inputs.value.invalidRecords,
      unmeasured: [
        ...forfeitureUnmeasured({ touched, records: inputs.value.records }),
        ...projections.flatMap((projection) => projection.unmeasured),
      ],
      projectionProblems: projections.flatMap((projection) => projection.problems),
    },
  };
};
