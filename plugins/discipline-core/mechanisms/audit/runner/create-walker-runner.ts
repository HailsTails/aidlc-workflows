import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type {
  RunnerClause,
  RunRequest,
  StandaloneRunner,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import {
  type CaseVerdict,
  type Hit,
  hitSchema,
  runnerResultSchema,
} from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { sameClauseAddress } from "../../../core/values/clause-address.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { observeWalkerFile } from "./observe-walker-file.ts";
import {
  type PreparedWalkerPiece,
  prepareWalkerPieces,
  type SelectedWalkerClause,
} from "./prepare-walker-pieces.ts";
import type { TypeScriptParsePort } from "./typescript-parse.ts";
import { walkerPieceSettingsSchema } from "./walker-check-schema.ts";
import type { WalkerFile, WalkerRepository } from "./walker-piece.ts";

type Outcome<Value> = Result<Value, RunnerFailure>;

type WalkerPorts = {
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly path: PathPort;
  readonly parse: TypeScriptParsePort;
};

type ClauseOrder = { readonly clauses: readonly RunnerClause[] };

const finishedHitsSchema = runnerResultSchema({ value: z.array(hitSchema).readonly() });

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: { kind: "piece-invalid", pieceRoot: request.pieceRoot, detail: request.detail },
});

const thrownDetail = (request: { readonly thrown: unknown }): string =>
  request.thrown instanceof Error ? request.thrown.message : String(request.thrown);

const gathered = <Value>(request: {
  readonly outcomes: readonly Outcome<readonly Value[]>[];
}): Outcome<readonly Value[]> =>
  request.outcomes.reduce<Outcome<readonly Value[]>>(
    (collected, next) => {
      if (collected.outcome === "failed") return collected;
      if (next.outcome === "failed") return next;
      return { outcome: "ok", value: [...collected.value, ...next.value] };
    },
    { outcome: "ok", value: [] },
  );

const selectedClause = (request: {
  readonly clause: RunnerClause;
  readonly path: PathPort;
}): Outcome<readonly SelectedWalkerClause[]> => {
  const settings = walkerPieceSettingsSchema.safeParse(request.clause.settings);
  if (!settings.success) {
    return pieceInvalid({ pieceRoot: request.clause.pieceRoot, detail: settings.error.message });
  }
  return {
    outcome: "ok",
    value: [
      {
        clause: request.clause,
        modulePath: request.path.join({ segments: [request.clause.pieceRoot, settings.data.module] }),
      },
    ],
  };
};

const selectedClauses = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly path: PathPort;
}): Outcome<readonly SelectedWalkerClause[]> =>
  gathered({ outcomes: request.clauses.map((clause) => selectedClause({ clause, path: request.path })) });

const preparedPieces = (request: {
  readonly ports: WalkerPorts;
  readonly clauses: readonly RunnerClause[];
  readonly repository: WalkerRepository;
}): Promise<Outcome<readonly PreparedWalkerPiece[]>> => {
  const selected = selectedClauses({ clauses: request.clauses, path: request.ports.path });
  if (selected.outcome === "failed") return Promise.resolve(selected);
  return prepareWalkerPieces({
    selected: selected.value,
    repository: request.repository,
    syntaxApi: request.ports.parse.syntaxApi,
    modules: request.ports.modules,
  });
};

const clauseRank = (request: ClauseOrder & { readonly hit: Hit }): number =>
  request.clauses.findIndex(
    (clause) => sameClauseAddress({ left: clause.address, right: request.hit.clause }) === "same",
  );

const inSourceOrder = (request: ClauseOrder & { readonly hits: readonly Hit[] }): readonly Hit[] =>
  [...request.hits].sort(
    (left, right) =>
      left.anchor.line - right.anchor.line ||
      left.anchor.column - right.anchor.column ||
      clauseRank({ clauses: request.clauses, hit: left }) - clauseRank({ clauses: request.clauses, hit: right }),
  );

const observedHits = (request: {
  readonly ports: WalkerPorts;
  readonly pieces: readonly PreparedWalkerPiece[];
  readonly clauses: readonly RunnerClause[];
  readonly file: WalkerFile;
}): Outcome<readonly Hit[]> => {
  const observed = observeWalkerFile({ file: request.file, pieces: request.pieces, parse: request.ports.parse });
  if (observed.outcome === "failed") return observed;
  return { outcome: "ok", value: inSourceOrder({ clauses: request.clauses, hits: observed.value.hits }) };
};

const finishedPiece = (request: { readonly piece: PreparedWalkerPiece }): Outcome<readonly Hit[]> => {
  const pieceRoot = request.piece.clauses[0]?.pieceRoot ?? request.piece.modulePath;
  try {
    const parsed = finishedHitsSchema.safeParse(request.piece.check.finish());
    if (!parsed.success) return pieceInvalid({ pieceRoot, detail: parsed.error.message });
    return parsed.data;
  } catch (thrown) {
    return pieceInvalid({ pieceRoot, detail: thrownDetail({ thrown }) });
  }
};

const walkedHits = (request: {
  readonly ports: WalkerPorts;
  readonly pieces: readonly PreparedWalkerPiece[];
  readonly clauses: readonly RunnerClause[];
  readonly files: readonly WalkerFile[];
}): Outcome<readonly Hit[]> => {
  const fromFiles = request.files.reduce<Outcome<readonly Hit[]>>(
    (collected, file) =>
      collected.outcome === "failed"
        ? collected
        : gathered({ outcomes: [collected, observedHits({ ...request, file })] }),
    { outcome: "ok", value: [] },
  );
  if (fromFiles.outcome === "failed") return fromFiles;
  return gathered({ outcomes: [fromFiles, ...request.pieces.map((piece) => finishedPiece({ piece }))] });
};

const repositoryFile = (request: {
  readonly ports: WalkerPorts;
  readonly repoRoot: string;
  readonly file: RepoPath;
}): WalkerFile => ({
  file: request.file,
  readText: () => {
    const text = request.ports.fileText.read({
      path: request.ports.path.join({ segments: [request.repoRoot, request.file] }),
    });
    if (text.outcome === "failed") {
      return { outcome: "failed", error: { kind: "file-unreadable", file: request.file, detail: text.error.detail } };
    }
    return text;
  },
});

const runOverRepository = (request: {
  readonly ports: WalkerPorts;
  readonly run: RunRequest;
}): Promise<Outcome<readonly Hit[]>> => {
  const repository: WalkerRepository = {
    files: request.run.trackedPaths,
    exists: ({ file }) =>
      request.ports.fileText.exists({
        path: request.ports.path.join({ segments: [request.run.repoRoot, file] }),
      }),
  };
  return preparedPieces({ ports: request.ports, clauses: request.run.clauses, repository }).then((pieces) => {
    if (pieces.outcome === "failed") return pieces;
    return walkedHits({
      ports: request.ports,
      pieces: pieces.value,
      clauses: request.run.clauses,
      files: request.run.trackedPaths.map((file) =>
        repositoryFile({ ports: request.ports, repoRoot: request.run.repoRoot, file }),
      ),
    });
  });
};

const caseFile = (request: { readonly sourceCase: SourceCase }): WalkerFile => ({
  file: request.sourceCase.fileName,
  readText: () => ({ outcome: "ok", value: request.sourceCase.source }),
});

const caseVerdict = (request: {
  readonly ports: WalkerPorts;
  readonly clause: RunnerClause;
  readonly sourceCase: SourceCase;
}): Promise<Outcome<readonly CaseVerdict[]>> => {
  const repository: WalkerRepository = {
    files: [request.sourceCase.fileName],
    exists: ({ file }) => (file === request.sourceCase.fileName ? "present" : "absent"),
  };
  return preparedPieces({ ports: request.ports, clauses: [request.clause], repository }).then((pieces) => {
    if (pieces.outcome === "failed") return pieces;
    const hits = walkedHits({
      ports: request.ports,
      pieces: pieces.value,
      clauses: [request.clause],
      files: [caseFile(request)],
    });
    if (hits.outcome === "failed") return hits;
    return {
      outcome: "ok",
      value: [
        {
          caseName: request.sourceCase.name,
          flaggedLines: [...new Set(hits.value.map((hit) => hit.anchor.line))],
        },
      ],
    };
  });
};

const conformCases = (request: {
  readonly ports: WalkerPorts;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
}): Promise<Outcome<readonly CaseVerdict[]>> =>
  request.cases.reduce<Promise<Outcome<readonly CaseVerdict[]>>>(
    (pending, sourceCase) =>
      pending.then((collected) =>
        collected.outcome === "failed"
          ? collected
          : caseVerdict({ ports: request.ports, clause: request.clause, sourceCase }).then((next) =>
              gathered({ outcomes: [collected, next] }),
            ),
      ),
    Promise.resolve({ outcome: "ok", value: [] }),
  );

export const createWalkerRunner = (ports: WalkerPorts): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (request) => runOverRepository({ ports, run: request }),
  conform: (request) => conformCases({ ports, clause: request.clause, cases: request.cases }),
});
