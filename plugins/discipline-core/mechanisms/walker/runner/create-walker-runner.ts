import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  LocationScope,
  RunnerClause,
  RunRequest,
  StandaloneRunner,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import {
  type CaseVerdict,
  type Hit,
  hitSchema,
  type MechanismObservations,
  runnerResultSchema,
} from "../../../core/mechanism-port/runner-result-schema.ts";
import type { DirectoryPort } from "../../../core/platform-ports/file-system-port.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { type ClauseAddress, sameClauseAddress } from "../../../core/values/clause-address.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { observeWalkerFile, type WalkerFileObservations } from "./observe-walker-file.ts";
import {
  type PreparedWalkerPiece,
  prepareWalkerPieces,
  type SelectedWalkerClause,
} from "./prepare-walker-pieces.ts";
import type { TypeScriptParsePort } from "./typescript-parse.ts";
import { walkerPieceSettingsSchema } from "./walker-check-schema.ts";
import type { WalkerRepository } from "./walker-piece.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type WalkerPorts = {
  readonly directory: DirectoryPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly parse: TypeScriptParsePort;
};

type ObservedFile = {
  readonly file: RepoPath;
  readonly observations: WalkerFileObservations;
};

const finishedHitsSchema = runnerResultSchema({ value: z.array(hitSchema).readonly() });

const collect = <Value>(request: { readonly outcomes: readonly Outcome<Value>[] }): Outcome<readonly Value[]> =>
  request.outcomes.reduce<Outcome<readonly Value[]>>((gathered, next) => {
    if (gathered.outcome === "failed") return gathered;
    if (next.outcome === "failed") return next;
    return { outcome: "ok", value: [...gathered.value, next.value] };
  }, { outcome: "ok", value: [] });

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", ...request },
});

const toolFailed = (request: {
  readonly location: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: `${request.location}: ${request.detail}` },
});

const selectedClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly SelectedWalkerClause[]> => collect({ outcomes: request.clauses.map((clause) => {
  const settings = walkerPieceSettingsSchema.safeParse(clause.settings);
  return settings.success
    ? { outcome: "ok", value: { clause, modulePath: request.path.join({ segments: [clause.pieceRoot, settings.data.module] }) } }
    : pieceInvalid({ pieceRoot: clause.pieceRoot, detail: settings.error.message });
}) });

const directoryFiles = (request: {
  readonly options: WalkerPorts;
  readonly run: RunRequest;
  readonly directory: AbsolutePath;
  readonly excluded: string | undefined;
}): Outcome<readonly RepoPath[]> => {
  const listing = request.options.directory.list({ path: request.directory });
  if (listing.outcome === "failed") {
    return toolFailed({ location: request.directory, detail: listing.error.detail });
  }
  return listing.value.reduce<Outcome<readonly RepoPath[]>>((gathered, entry) => {
    if (gathered.outcome === "failed") return gathered;
    const joined = request.options.path.join({ segments: [request.directory, entry.name] });
    const location = absolutePathSchema.safeParse(joined);
    if (!location.success) return toolFailed({ location: joined, detail: location.error.message });
    const relative = request.options.path.relative({ from: request.run.repoRoot, to: location.data });
    if (relative.relation !== "within-root") {
      return toolFailed({ location: joined, detail: "the directory entry is outside the repository root" });
    }
    if (relative.path === request.excluded) return gathered;
    const file = repoPathSchema.safeParse(relative.path);
    if (!file.success) return toolFailed({ location: joined, detail: file.error.message });
    if (entry.kind === "directory") {
      const nested = directoryFiles({ ...request, directory: location.data });
      return nested.outcome === "failed" ? nested : { outcome: "ok", value: [...gathered.value, ...nested.value] };
    }
    return { outcome: "ok", value: [...gathered.value, file.data] };
  }, { outcome: "ok", value: [] });
};

const repositoryFiles = (request: {
  readonly options: WalkerPorts;
  readonly run: RunRequest;
}): Outcome<readonly RepoPath[]> => {
  const installation = request.options.path.relative({ from: request.run.repoRoot, to: request.run.installRoot });
  if (installation.relation === "within-root" && installation.path === "") return { outcome: "ok", value: [] };
  return directoryFiles({
    ...request,
    directory: request.run.repoRoot,
    excluded: installation.relation === "within-root" ? installation.path : undefined,
  });
};

const inclusion = (request: {
  readonly includes: LocationScope | undefined;
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
}): "included" | "excluded" => request.includes?.({ clause: request.clause, file: request.file }) ?? "included";

const finishedPiece = (request: {
  readonly piece: PreparedWalkerPiece;
  readonly includes: LocationScope | undefined;
}): Outcome<readonly Hit[]> => {
  const pieceRoot = request.piece.clauses[0]?.pieceRoot ?? request.piece.modulePath;
  try {
    const parsed = finishedHitsSchema.safeParse(request.piece.check.finish());
    if (!parsed.success) return pieceInvalid({ pieceRoot, detail: parsed.error.message });
    if (parsed.data.outcome === "failed") return parsed.data;
    if (parsed.data.value.some((hit) => !request.piece.clauses.some((clause) =>
      sameClauseAddress({ left: clause.address, right: hit.clause }) === "same",
    ))) return pieceInvalid({ pieceRoot, detail: "the piece emitted a hit for a clause outside its selected clauses" });
    return {
      outcome: "ok",
      value: parsed.data.value.filter((hit) => inclusion({ includes: request.includes, clause: hit.clause, file: hit.file }) === "included"),
    };
  } catch (thrown) {
    return pieceInvalid({ pieceRoot, detail: thrown instanceof Error ? thrown.message : String(thrown) });
  }
};

const observedFiles = (request: {
  readonly files: readonly RepoPath[];
  readonly pieces: readonly PreparedWalkerPiece[];
  readonly parse: TypeScriptParsePort;
  readonly includes: LocationScope | undefined;
  readonly readText: (request: { readonly file: RepoPath }) => Outcome<string>;
}): Outcome<readonly ObservedFile[]> => request.files.reduce<Outcome<readonly ObservedFile[]>>((gathered, file) => {
  if (gathered.outcome === "failed") return gathered;
  const observed = observeWalkerFile({
    file: { file, readText: () => request.readText({ file }) },
    pieces: request.pieces.filter((piece) => piece.clauses.some((clause) =>
      inclusion({ includes: request.includes, clause: clause.address, file }) === "included",
    )),
    parse: request.parse,
  });
  if (observed.outcome === "failed") return observed;
  return {
    outcome: "ok",
    value: [...gathered.value, {
      file,
      observations: {
        hits: observed.value.hits.filter((hit) => inclusion({ includes: request.includes, clause: hit.clause, file }) === "included"),
        applicable: observed.value.applicable.filter((clause) => inclusion({ includes: request.includes, clause, file }) === "included"),
      },
    }],
  };
}, { outcome: "ok", value: [] });

const executePrepared = async (request: {
  readonly options: WalkerPorts;
  readonly clauses: readonly RunnerClause[];
  readonly files: readonly RepoPath[];
  readonly includes: LocationScope | undefined;
  readonly readText: (request: { readonly file: RepoPath }) => Outcome<string>;
}): Promise<Outcome<MechanismObservations>> => {
  const selected = selectedClauses({ clauses: request.clauses, path: request.options.path });
  if (selected.outcome === "failed") return selected;
  const repository: WalkerRepository = {
    files: request.files,
    exists: ({ file }) => request.files.includes(file) ? "present" : "absent",
  };
  const prepared = await prepareWalkerPieces({
    selected: selected.value,
    repository,
    syntaxApi: request.options.parse.syntaxApi,
    modules: request.options.modules,
  });
  if (prepared.outcome === "failed") return prepared;
  const observed = observedFiles({ ...request, pieces: prepared.value, parse: request.options.parse });
  if (observed.outcome === "failed") return observed;
  const completed = prepared.value.reduce<Outcome<readonly Hit[]>>((gathered, piece) => {
    if (gathered.outcome === "failed") return gathered;
    const finished = finishedPiece({ piece, includes: request.includes });
    return finished.outcome === "failed" ? finished : { outcome: "ok", value: [...gathered.value, ...finished.value] };
  }, { outcome: "ok", value: [] });
  if (completed.outcome === "failed") return completed;
  return {
    outcome: "ok",
    value: {
      hits: [...observed.value.flatMap((observedFile) => observedFile.observations.hits), ...completed.value],
      evaluated: request.clauses.map((clause) => ({
        clause: clause.address,
        files: observed.value.flatMap((observedFile) =>
          observedFile.observations.applicable.some((address) =>
            sameClauseAddress({ left: address, right: clause.address }) === "same",
          ) ? [observedFile.file] : [],
        ),
      })),
    },
  };
};

const runRepository = (request: {
  readonly options: WalkerPorts;
  readonly run: RunRequest;
}): Promise<Outcome<MechanismObservations>> => {
  const files = repositoryFiles(request);
  if (files.outcome === "failed") return Promise.resolve(files);
  return executePrepared({
    ...request,
    clauses: request.run.clauses,
    files: files.value,
    includes: request.run.includes,
    readText: ({ file }) => {
      const text = request.options.fileText.read({
        path: request.options.path.join({ segments: [request.run.repoRoot, file] }),
      });
      return text.outcome === "failed"
        ? { outcome: "failed", error: { kind: "file-unreadable", file, detail: text.error.detail } }
        : text;
    },
  });
};

const conformCase = async (request: {
  readonly options: WalkerPorts;
  readonly clause: RunnerClause;
  readonly sourceCase: SourceCase;
}): Promise<Outcome<CaseVerdict>> => {
  const observed = await executePrepared({
    options: request.options,
    clauses: [request.clause],
    files: [request.sourceCase.fileName],
    includes: undefined,
    readText: () => ({ outcome: "ok", value: request.sourceCase.source }),
  });
  if (observed.outcome === "failed") return observed;
  if (observed.value.hits.some((hit) => !observed.value.evaluated.some((evaluation) =>
    sameClauseAddress({ left: hit.clause, right: evaluation.clause }) === "same" && evaluation.files.includes(hit.file),
  ))) return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: "a conformance hit names a file outside its clause's evaluated case" });
  return {
    outcome: "ok",
    value: {
      caseName: request.sourceCase.name,
      flaggedLines: [...new Set(observed.value.hits.map((hit) => hit.anchor.line))],
    },
  };
};

export const createWalkerRunner = (options: WalkerPorts): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (run) => runRepository({ options, run }),
  conform: (request) => request.cases.reduce<Promise<Outcome<readonly CaseVerdict[]>>>(
    async (pending, sourceCase) => {
      const gathered = await pending;
      if (gathered.outcome === "failed") return gathered;
      const verdict = await conformCase({ options, clause: request.clause, sourceCase });
      return verdict.outcome === "failed" ? verdict : { outcome: "ok", value: [...gathered.value, verdict.value] };
    },
    Promise.resolve({ outcome: "ok", value: [] }),
  ),
});
