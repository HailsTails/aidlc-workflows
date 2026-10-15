import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { AnchorKind } from "../values/anchor.ts";
import {
  type ClauseId,
  clauseIdSchema,
  type DisciplineId,
  disciplineIdSchema,
  type MechanismId,
  mechanismIdSchema,
} from "../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export type SourceCase = {
  readonly name: string;
  readonly fileName: RepoPath;
  readonly source: string;
  readonly expectedLines: readonly number[];
};

export type ClauseDefinition =
  | {
      readonly kind: "mechanical";
      readonly id: ClauseId;
      readonly summary: string;
      readonly mechanisms: readonly MechanismId[];
      readonly anchor: AnchorKind;
      readonly cases: {
        readonly flag: readonly SourceCase[];
        readonly allow: readonly SourceCase[];
      };
    }
  | {
      readonly kind: "judgement";
      readonly id: ClauseId;
      readonly summary: string;
      readonly enforcedBy: "review";
    };

export type DisciplineFile = {
  readonly version: 1;
  readonly id: DisciplineId;
  readonly clauses: readonly ClauseDefinition[];
};

export type PieceFile = {
  readonly version: 1;
  readonly discipline: DisciplineId;
  readonly mechanism: MechanismId;
  readonly clauses: readonly {
    readonly clause: ClauseId;
    readonly settings: unknown;
  }[];
};

const SUPPORTED_VERSION = 1;

export const parsedJson = (request: {
  readonly text: string;
}): Result<unknown, string> => {
  try {
    const parsed: unknown = JSON.parse(request.text);
    return { outcome: "ok", value: parsed };
  } catch (thrown) {
    return {
      outcome: "failed",
      error: thrown instanceof Error ? thrown.message : String(thrown),
    };
  }
};

export const readVersionOneJson = (request: {
  readonly fileText: FileTextPort;
  readonly path: string;
}): Result<unknown, LoadFailure> => {
  const text = request.fileText.read({ path: request.path });
  if (text.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-unreadable", path: request.path, detail: text.error.detail },
    };
  }
  const parsed = parsedJson({ text: text.value });
  if (parsed.outcome === "failed") {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path: request.path, detail: parsed.error },
    };
  }
  const document = parsed.value;
  if (
    typeof document === "object" &&
    document !== null &&
    "version" in document &&
    document.version !== SUPPORTED_VERSION
  ) {
    return {
      outcome: "failed",
      error: { kind: "unsupported-version", path: request.path, found: document.version },
    };
  }
  return { outcome: "ok", value: document };
};

const entryCount = (entries: readonly unknown[]): "empty" | "some" =>
  entries.length > 0 ? "some" : "empty";

const textDistinctness = (texts: readonly string[]): "distinct" | "repeated" =>
  new Set(texts).size === texts.length ? "distinct" : "repeated";

const sourceCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
});

const flagCaseSchema = sourceCaseSchema.refine(
  (sourceCase) => entryCount(sourceCase.expectedLines) === "some",
  { error: "a flag case names no expected line" },
);

const allowCaseSchema = sourceCaseSchema.refine(
  (sourceCase) => entryCount(sourceCase.expectedLines) === "empty",
  { error: "an allow case names expected lines" },
);

const anchorKindSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keyword"), keyword: z.string() }),
  z.object({ kind: z.literal("file") }),
]);

const clauseDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mechanical"),
    id: clauseIdSchema,
    summary: z.string(),
    mechanisms: z
      .array(mechanismIdSchema)
      .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause names no mechanism" }),
    anchor: anchorKindSchema,
    cases: z.object({
      flag: z
        .array(flagCaseSchema)
        .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause has no flag case" }),
      allow: z
        .array(allowCaseSchema)
        .refine((entries) => entryCount(entries) === "some", { error: "a mechanical clause has no allow case" }),
    }),
  }),
  z.object({
    kind: z.literal("judgement"),
    id: clauseIdSchema,
    summary: z.string(),
    enforcedBy: z.literal("review"),
  }),
]);

const disciplineFileSchema = z.object({
  version: z.literal(SUPPORTED_VERSION),
  id: disciplineIdSchema,
  clauses: z
    .array(clauseDefinitionSchema)
    .refine((clauses) => textDistinctness(clauses.map((clause) => clause.id)) === "distinct", {
      error: "two clauses share an id",
    }),
});

const pieceFileSchema = z.object({
  version: z.literal(SUPPORTED_VERSION),
  discipline: disciplineIdSchema,
  mechanism: mechanismIdSchema,
  clauses: z
    .array(z.object({ clause: clauseIdSchema, settings: z.unknown() }))
    .refine((entries) => textDistinctness(entries.map((entry) => entry.clause)) === "distinct", {
      error: "two entries name the same clause",
    }),
});

const isContentRefusal = (
  issue: z.core.$ZodIssue,
): issue is z.core.$ZodIssueCustom => issue.code === "custom";

const schemaRefusal = (request: {
  readonly path: string;
  readonly error: z.ZodError;
}): LoadFailure => {
  const detail = z.prettifyError(request.error);
  return request.error.issues.every(isContentRefusal)
    ? { kind: "rule-set-invalid", path: request.path, detail }
    : { kind: "file-malformed", path: request.path, detail };
};

const ruleSetInvalid = (request: {
  readonly path: string;
  readonly detail: string;
}): { readonly outcome: "failed"; readonly error: LoadFailure } => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", path: request.path, detail: request.detail },
});

export const disciplineFilePath = (request: {
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineId;
}): string =>
  request.path.join({
    segments: [request.ruleSetRoot, "rules", request.discipline, "discipline.json"],
  });

export const pieceFilePath = (request: {
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly mechanism: MechanismId;
  readonly discipline: DisciplineId;
}): string =>
  request.path.join({
    segments: [
      request.ruleSetRoot,
      "mechanisms",
      request.mechanism,
      request.discipline,
      "piece.json",
    ],
  });

export const readDisciplineFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly discipline: DisciplineId;
}): Result<DisciplineFile, LoadFailure> => {
  const path = disciplineFilePath(request);
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = disciplineFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return { outcome: "failed", error: schemaRefusal({ path, error: parsed.error }) };
  }
  if (parsed.data.id !== request.discipline) {
    return ruleSetInvalid({
      path,
      detail: `id ${parsed.data.id} differs from its folder name ${request.discipline}`,
    });
  }
  return { outcome: "ok", value: parsed.data };
};

export const readPieceFile = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly mechanism: MechanismId;
  readonly discipline: DisciplineFile;
}): Result<PieceFile, LoadFailure> => {
  const path = pieceFilePath({
    path: request.path,
    ruleSetRoot: request.ruleSetRoot,
    mechanism: request.mechanism,
    discipline: request.discipline.id,
  });
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = pieceFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return { outcome: "failed", error: schemaRefusal({ path, error: parsed.error }) };
  }
  const piece = parsed.data;
  if (piece.discipline !== request.discipline.id) {
    return ruleSetInvalid({
      path,
      detail: `discipline ${piece.discipline} differs from its folder name ${request.discipline.id}`,
    });
  }
  if (piece.mechanism !== request.mechanism) {
    return ruleSetInvalid({
      path,
      detail: `mechanism ${piece.mechanism} differs from its folder name ${request.mechanism}`,
    });
  }
  const declared = request.discipline.clauses.map((clause) => clause.id);
  const undeclared = piece.clauses.find((entry) => !declared.includes(entry.clause));
  if (undeclared !== undefined) {
    return ruleSetInvalid({
      path,
      detail: `clause ${undeclared.clause} is not declared by discipline ${request.discipline.id}`,
    });
  }
  return { outcome: "ok", value: piece };
};
