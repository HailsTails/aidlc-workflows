import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
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
import type { AbsolutePath } from "../values/absolute-path.ts";
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

type ResolvedClause = SelectedClause & { readonly discipline: DisciplineFile };

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

const ruleSetRoot = (request: {
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly ruleSets: ConsumerSelectionFile["ruleSets"];
  readonly address: ClauseAddress;
}): Result<AbsolutePath, LoadFailure> => {
  const ruleSet = request.address.ruleSet;
  if (ruleSet === SHARED_RULE_SET) {
    return { outcome: "ok", value: request.installRoot };
  }
  const declared = request.ruleSets.find(([name]) => name === ruleSet.name);
  if (declared === undefined) {
    return failed({ kind: "unknown-rule-set", name: ruleSet.name });
  }
  return {
    outcome: "ok",
    value: request.path.resolve({
      path: request.path.join({ segments: [request.repoRoot, declared[1]] }),
    }),
  };
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
  const { address, mechanism } = request;
  const addressText = clauseAddressText({ address });
  const root = ruleSetRoot(request);
  if (root.outcome === "failed") {
    return root;
  }
  const disciplineLocation = {
    path: request.path,
    ruleSetRoot: root.value,
    discipline: address.discipline,
  };
  if (request.fileText.exists({ path: disciplineFilePath(disciplineLocation) }) === "absent") {
    return failed({ kind: "unknown-discipline", address: addressText });
  }
  const discipline = readDisciplineFile({ ...disciplineLocation, fileText: request.fileText });
  if (discipline.outcome === "failed") {
    return discipline;
  }
  const definition = discipline.value.clauses.find((clause) => clause.id === address.clause);
  if (definition === undefined) {
    return failed({ kind: "unknown-clause", address: addressText });
  }
  if (definition.kind === "judgement") {
    return failed({ kind: "judgement-clause-selected", address: addressText });
  }
  if (!definition.mechanisms.includes(mechanism)) {
    return failed({ kind: "mechanism-not-allowed", address: addressText, mechanism });
  }
  const runnerPath = request.path.join({
    segments: [request.installRoot, "mechanisms", mechanism, "runner", "runner.ts"],
  });
  if (request.fileText.exists({ path: runnerPath }) === "absent") {
    return failed({ kind: "runner-missing", mechanism });
  }
  const pieceLocation = { ...disciplineLocation, mechanism };
  if (request.fileText.exists({ path: pieceFilePath(pieceLocation) }) === "absent") {
    return failed({ kind: "piece-missing", address: addressText, mechanism });
  }
  const piece = readPieceFile({
    ...pieceLocation,
    fileText: request.fileText,
    discipline: discipline.value,
  });
  if (piece.outcome === "failed") {
    return piece;
  }
  if (!piece.value.clauses.some((entry) => entry.clause === address.clause)) {
    return failed({ kind: "piece-missing", address: addressText, mechanism });
  }
  return { outcome: "ok", value: { address, mechanism, discipline: discipline.value } };
};

const uncoveredClauses = (request: {
  readonly resolved: readonly ResolvedClause[];
}): readonly ClauseAddress[] => {
  const adopted = request.resolved.filter(
    (clause, index) =>
      request.resolved.findIndex(
        (earlier) =>
          sameClauseAddress({
            left: { ...earlier.address, clause: clause.address.clause },
            right: clause.address,
          }) === "same",
      ) === index,
  );
  return adopted.flatMap((representative) =>
    representative.discipline.clauses
      .filter((definition) => definition.kind === "mechanical")
      .map((definition): ClauseAddress => ({ ...representative.address, clause: definition.id }))
      .filter(
        (address) =>
          !request.resolved.some(
            (listed) => sameClauseAddress({ left: listed.address, right: address }) === "same",
          ),
      ),
  );
};

export const readSelection = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
}): Result<Selection, LoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, "disciplines.json"] });
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = consumerSelectionFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return failed({ kind: "file-malformed", path, detail: z.prettifyError(parsed.error) });
  }
  const reserved = parsed.data.ruleSets.find(([name]) => name === SHARED_RULE_SET);
  if (reserved !== undefined) {
    return failed({ kind: "reserved-rule-set-name", name: reserved[0] });
  }
  const resolved = parsed.data.clauses.reduce<Result<readonly ResolvedClause[], LoadFailure>>(
    (sofar, [address, mechanism]) => {
      if (sofar.outcome === "failed") {
        return sofar;
      }
      const clause = resolveClause({ ...request, ruleSets: parsed.data.ruleSets, address, mechanism });
      return clause.outcome === "failed"
        ? clause
        : { outcome: "ok", value: [...sofar.value, clause.value] };
    },
    { outcome: "ok", value: [] },
  );
  if (resolved.outcome === "failed") {
    return resolved;
  }
  return {
    outcome: "ok",
    value: {
      selected: resolved.value.map(({ address, mechanism }) => ({ address, mechanism })),
      uncovered: uncoveredClauses({ resolved: resolved.value }),
    },
  };
};
