import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import { runnerResultSchema } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import type { Result } from "../../../core/values/result.ts";
import type { SyntaxApi } from "./typescript-parse.ts";
import type { WalkerFile, WalkerRepository } from "./walker-piece.ts";

export type SelectedWalkerClause = {
  readonly modulePath: string;
  readonly clause: RunnerClause;
};

export type LoadedPreparedWalkerCheck = {
  readonly prepareFile: (request: WalkerFile) => unknown;
  readonly finish: () => unknown;
};

export type PreparedWalkerPiece = {
  readonly modulePath: string;
  readonly clauses: readonly RunnerClause[];
  readonly check: LoadedPreparedWalkerCheck;
};

export type PrepareWalkerPiecesRequest = {
  readonly selected: readonly SelectedWalkerClause[];
  readonly repository: WalkerRepository;
  readonly syntaxApi: SyntaxApi;
  readonly modules: ModuleLoaderPort;
};

export type PrepareWalkerPiecesResult = Result<readonly PreparedWalkerPiece[], RunnerFailure>;

type PreparedWalkerPieceResult = Result<PreparedWalkerPiece, RunnerFailure>;

const preparationCallSchema = z.function({
  input: [z.unknown()],
  output: z.unknown(),
});

const registeredWalkerPieceModuleSchema = z.object({
  check: z.object({ prepare: preparationCallSchema }),
});

const loadedPreparedWalkerCheckSchema = z.object({
  prepareFile: z.function({ input: [z.unknown()], output: z.unknown() }),
  finish: z.function({ input: [], output: z.unknown() }),
});

const walkerPreparationResultSchema = runnerResultSchema({
  value: loadedPreparedWalkerCheckSchema,
});

const pieceInvalid = (request: {
  readonly pieceRoot: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: RunnerFailure } => ({
  outcome: "failed",
  error: {
    kind: "piece-invalid",
    pieceRoot: request.pieceRoot,
    detail: request.detail,
  },
});

const firstPerModule = (request: {
  readonly selected: readonly SelectedWalkerClause[];
}): readonly SelectedWalkerClause[] =>
  request.selected.filter(
    (entry, index) =>
      request.selected.findIndex((other) => other.modulePath === entry.modulePath) === index,
  );

const clausesForModule = (request: {
  readonly selected: readonly SelectedWalkerClause[];
  readonly modulePath: string;
}): readonly RunnerClause[] =>
  request.selected
    .filter((entry) => entry.modulePath === request.modulePath)
    .map((entry) => entry.clause);

const acceptedPreparation = (request: {
  readonly returned: unknown;
  readonly selected: SelectedWalkerClause;
  readonly clauses: readonly RunnerClause[];
}): PreparedWalkerPieceResult => {
  const parsed = walkerPreparationResultSchema.safeParse(request.returned);
  if (!parsed.success) {
    return pieceInvalid({
      pieceRoot: request.selected.clause.pieceRoot,
      detail: parsed.error.message,
    });
  }
  if (parsed.data.outcome === "failed") {
    return parsed.data;
  }
  return {
    outcome: "ok",
    value: {
      modulePath: request.selected.modulePath,
      clauses: request.clauses,
      check: parsed.data.value,
    },
  };
};

const acceptedModule = (request: {
  readonly loaded: ModuleLoad;
  readonly selected: SelectedWalkerClause;
  readonly clauses: readonly RunnerClause[];
  readonly repository: WalkerRepository;
  readonly syntaxApi: SyntaxApi;
}): PreparedWalkerPieceResult => {
  if (request.loaded.outcome === "failed") {
    return pieceInvalid({
      pieceRoot: request.selected.clause.pieceRoot,
      detail: request.loaded.error.detail,
    });
  }
  const parsed = registeredWalkerPieceModuleSchema.safeParse(request.loaded.value);
  if (!parsed.success) {
    return pieceInvalid({
      pieceRoot: request.selected.clause.pieceRoot,
      detail: parsed.error.message,
    });
  }
  try {
    return acceptedPreparation({
      returned: parsed.data.check.prepare({
        clauses: request.clauses,
        repository: request.repository,
        syntaxApi: request.syntaxApi,
      }),
      selected: request.selected,
      clauses: request.clauses,
    });
  } catch (thrown) {
    return pieceInvalid({
      pieceRoot: request.selected.clause.pieceRoot,
      detail: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }
};

const loadModule = (request: {
  readonly selected: SelectedWalkerClause;
  readonly preparation: PrepareWalkerPiecesRequest;
}): Promise<PreparedWalkerPieceResult> => {
  const clauses = clausesForModule({
    selected: request.preparation.selected,
    modulePath: request.selected.modulePath,
  });
  return request.preparation.modules.load({ path: request.selected.modulePath }).then((loaded) =>
    acceptedModule({
      loaded,
      selected: request.selected,
      clauses,
      repository: request.preparation.repository,
      syntaxApi: request.preparation.syntaxApi,
    }),
  );
};

const collectPreparations = (request: {
  readonly preparations: readonly PreparedWalkerPieceResult[];
}): PrepareWalkerPiecesResult =>
  request.preparations.reduce<PrepareWalkerPiecesResult>(
    (gathered, next) => {
      if (gathered.outcome === "failed") {
        return gathered;
      }
      if (next.outcome === "failed") {
        return next;
      }
      return { outcome: "ok", value: [...gathered.value, next.value] };
    },
    { outcome: "ok", value: [] },
  );

export const prepareWalkerPieces = (
  request: PrepareWalkerPiecesRequest,
): Promise<PrepareWalkerPiecesResult> =>
  Promise.all(
    firstPerModule(request).map((selected) => loadModule({ selected, preparation: request })),
  ).then((preparations) => collectPreparations({ preparations }));
