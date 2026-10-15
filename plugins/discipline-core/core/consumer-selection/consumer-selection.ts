import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
import type { RunnerClause } from "../mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import {
  type DisciplineFile,
  disciplineFilePath,
  pieceFilePath,
  readDisciplineFile,
  readPieceFile,
  readVersionOneJson,
} from "../rule-set-reader/rule-set-reader.ts";
import { type AbsolutePath, absolutePathSchema } from "../values/absolute-path.ts";
import {
  type ClauseAddress,
  clauseAddressSchema,
  clauseAddressText,
  sameClauseAddress,
} from "../values/clause-address.ts";
import {
  type MechanismId,
  mechanismIdSchema,
  ruleSetNameSchema,
} from "../values/identifiers.ts";
import type { Result } from "../values/result.ts";

export type SelectedClause = {
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
};

export type Selection = {
  readonly selected: readonly SelectedClause[];
  readonly uncovered: readonly ClauseAddress[];
};

export type ClauseBinding = {
  readonly mechanism: MechanismId;
  readonly clause: RunnerClause;
};

export type SelectionReading = {
  readonly selection: Selection;
  readonly bindings: readonly ClauseBinding[];
};

type ResolvedClause = {
  readonly discipline: DisciplineFile;
  readonly binding: ClauseBinding;
};

const SHARED_RULE_SET = "shared";

const consumerSelectionFileSchema = z.strictObject({
  version: z.literal(1),
  ruleSets: z
    .record(ruleSetNameSchema, z.string())
    .transform((ruleSets) => Object.entries(ruleSets))
    .pipe(z.array(z.tuple([ruleSetNameSchema, z.string()]))),
  clauses: z
    .record(z.string(), z.string())
    .transform((clauses) => Object.entries(clauses))
    .pipe(z.array(z.tuple([clauseAddressSchema, mechanismIdSchema]))),
});

type ConsumerSelectionFile = z.infer<typeof consumerSelectionFileSchema>;

const failed = (error: LoadFailure): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error,
});

export const ruleSetRootOf = (request: {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly ruleSets: Readonly<Record<string, string>>;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly path: PathPort;
}): Result<AbsolutePath, LoadFailure> => {
  const ruleSet = request.ruleSet;
  if (ruleSet === SHARED_RULE_SET) {
    return { outcome: "ok", value: request.installRoot };
  }
  const declared = Object.entries(request.ruleSets).find(([name]) => name === ruleSet.name);
  if (declared === undefined) {
    return failed({ kind: "unknown-rule-set", name: ruleSet.name });
  }
  const directory = request.path.join({ segments: [request.repoRoot, declared[1]] });
  const parsed = absolutePathSchema.safeParse(request.path.resolve({ path: directory }));
  if (!parsed.success) {
    return failed({
      kind: "rule-set-invalid",
      path: directory,
      detail: `the directory of rule set ${ruleSet.name} resolves to no absolute path`,
    });
  }
  return { outcome: "ok", value: parsed.data };
};

type ClauseRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly ruleSetRoot: AbsolutePath;
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
};

type MechanicalDefinition = Extract<DisciplineFile["clauses"][number], { readonly kind: "mechanical" }>;

type DefinedClause = {
  readonly discipline: DisciplineFile;
  readonly definition: MechanicalDefinition;
};

const definedClause = (request: ClauseRequest): Result<DefinedClause, LoadFailure> => {
  const address = clauseAddressText({ address: request.address });
  const location = { path: request.path, ruleSetRoot: request.ruleSetRoot, discipline: request.address.discipline };
  if (request.fileText.exists({ path: disciplineFilePath(location) }) === "absent") {
    return failed({ kind: "unknown-discipline", address });
  }
  const discipline = readDisciplineFile({ ...location, fileText: request.fileText });
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find((clause) => clause.id === request.address.clause);
  if (definition === undefined) {
    return failed({ kind: "unknown-clause", address });
  }
  if (definition.kind === "judgement") {
    return failed({ kind: "judgement-clause-selected", address });
  }
  if (!definition.mechanisms.includes(request.mechanism)) {
    return failed({ kind: "mechanism-not-allowed", address, mechanism: request.mechanism });
  }
  return { outcome: "ok", value: { discipline: discipline.value, definition } };
};

const pieceSettings = (request: ClauseRequest & { readonly discipline: DisciplineFile }): Result<unknown, LoadFailure> => {
  const address = clauseAddressText({ address: request.address });
  const runnerPath = request.path.join({
    segments: [request.installRoot, "mechanisms", request.mechanism, "runner", "runner.ts"],
  });
  if (request.fileText.exists({ path: runnerPath }) === "absent") {
    return failed({ kind: "runner-missing", mechanism: request.mechanism });
  }
  const location = {
    path: request.path,
    ruleSetRoot: request.ruleSetRoot,
    discipline: request.address.discipline,
    mechanism: request.mechanism,
  };
  if (request.fileText.exists({ path: pieceFilePath(location) }) === "absent") {
    return failed({ kind: "piece-missing", address, mechanism: request.mechanism });
  }
  const piece = readPieceFile({ ...location, fileText: request.fileText, discipline: request.discipline });
  if (piece.outcome === "failed") {
    return piece;
  }
  const entry = piece.value.clauses.find((candidate) => candidate.clause === request.address.clause);
  if (entry === undefined) {
    return failed({ kind: "piece-missing", address, mechanism: request.mechanism });
  }
  return { outcome: "ok", value: entry.settings };
};

const resolveClause = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly ruleSets: ConsumerSelectionFile["ruleSets"];
  readonly address: ClauseAddress;
  readonly mechanism: MechanismId;
}): Result<ResolvedClause, LoadFailure> => {
  const root = ruleSetRootOf({ ...request, ruleSet: request.address.ruleSet, ruleSets: Object.fromEntries(request.ruleSets) });
  if (root.outcome === "failed") {
    return root;
  }
  const clauseRequest = { ...request, ruleSetRoot: root.value };
  const defined = definedClause(clauseRequest);
  if (defined.outcome === "failed") {
    return defined;
  }
  const settings = pieceSettings({ ...clauseRequest, discipline: defined.value.discipline });
  if (settings.outcome === "failed") {
    return settings;
  }
  return {
    outcome: "ok",
    value: {
      discipline: defined.value.discipline,
      binding: {
        mechanism: request.mechanism,
        clause: {
          address: request.address,
          anchor: defined.value.definition.anchor,
          pieceRoot: request.path.join({
            segments: [root.value, "mechanisms", request.mechanism, request.address.discipline],
          }),
          settings: settings.value,
        },
      },
    },
  };
};

const addressOf = (request: { readonly resolved: ResolvedClause }): ClauseAddress =>
  request.resolved.binding.clause.address;

const occurrenceInDiscipline = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly clause: ResolvedClause;
  readonly index: number;
}): "first" | "repeat" => {
  const address = addressOf({ resolved: request.clause });
  const firstIndex = request.resolved.findIndex(
    (earlier) =>
      sameClauseAddress({ left: { ...addressOf({ resolved: earlier }), clause: address.clause }, right: address }) ===
      "same",
  );
  return firstIndex === request.index ? "first" : "repeat";
};

const listingOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly address: ClauseAddress;
}): "listed" | "unlisted" =>
  request.resolved.some(
    (listed) => sameClauseAddress({ left: addressOf({ resolved: listed }), right: request.address }) === "same",
  )
    ? "listed"
    : "unlisted";

const unlistedClausesOf = (request: {
  readonly resolved: readonly ResolvedClause[];
  readonly representative: ResolvedClause;
}): readonly ClauseAddress[] =>
  request.representative.discipline.clauses
    .filter((definition) => definition.kind === "mechanical")
    .map((definition): ClauseAddress => ({ ...addressOf({ resolved: request.representative }), clause: definition.id }))
    .filter((address) => listingOf({ resolved: request.resolved, address }) === "unlisted");

const uncoveredClauses = (request: {
  readonly resolved: readonly ResolvedClause[];
}): readonly ClauseAddress[] =>
  request.resolved
    .filter((clause, index) => occurrenceInDiscipline({ resolved: request.resolved, clause, index }) === "first")
    .flatMap((representative) => unlistedClausesOf({ resolved: request.resolved, representative }));

const resolvedClauses = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly file: ConsumerSelectionFile;
}): Result<readonly ResolvedClause[], LoadFailure> =>
  request.file.clauses.reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, [address, mechanism]) =>
      appendedClause({
        sofar,
        resolve: () => resolveClause({ ...request, ruleSets: request.file.ruleSets, address, mechanism }),
      }),
    { outcome: "ok", value: [] },
  );

const appendedClause = (request: {
  readonly sofar: Result<readonly ResolvedClause[], LoadFailure>;
  readonly resolve: () => Result<ResolvedClause, LoadFailure>;
}): Result<readonly ResolvedClause[], LoadFailure> => {
  if (request.sofar.outcome === "failed") {
    return request.sofar;
  }
  const clause = request.resolve();
  if (clause.outcome === "failed") {
    return clause;
  }
  return { outcome: "ok", value: [...request.sofar.value, clause.value] };
};

const parsedSelectionFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<ConsumerSelectionFile, LoadFailure> => {
  const document = readVersionOneJson(request);
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = consumerSelectionFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return failed({ kind: "file-malformed", path: request.path, detail: z.prettifyError(parsed.error) });
  }
  const reserved = parsed.data.ruleSets.find(([name]) => name === SHARED_RULE_SET);
  if (reserved !== undefined) {
    return failed({ kind: "reserved-rule-set-name", name: reserved[0] });
  }
  return { outcome: "ok", value: parsed.data };
};

const selectionReadingOf = (request: { readonly resolved: readonly ResolvedClause[] }): SelectionReading => ({
  selection: {
    selected: request.resolved.map(({ binding }) => ({ address: binding.clause.address, mechanism: binding.mechanism })),
    uncovered: uncoveredClauses(request),
  },
  bindings: request.resolved.map(({ binding }) => binding),
});

export const readSelection = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}): Result<SelectionReading, LoadFailure> => {
  const file = parsedSelectionFile({
    fileText: request.fileText,
    path: request.path.join({ segments: [request.repoRoot, "disciplines.json"] }),
  });
  if (file.outcome === "failed") {
    return file;
  }
  const resolved = resolvedClauses({ ...request, file: file.value });
  if (resolved.outcome === "failed") {
    return resolved;
  }
  return { outcome: "ok", value: selectionReadingOf({ resolved: resolved.value }) };
};
