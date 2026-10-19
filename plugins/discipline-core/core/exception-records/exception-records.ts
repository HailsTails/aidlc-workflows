import { z } from "zod";
import type { LoadFailure } from "../check/load-failure.ts";
import type { Selection } from "../consumer-selection/selection.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../platform-ports/file-text-port.ts";
import { createDefaultPathPort, type PathPort } from "../platform-ports/path-port.ts";
import { parsedJson, readVersionOneJson } from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import {
  type ClauseAddress,
  clauseAddressSchema,
  sameClauseAddress,
} from "../values/clause-address.ts";
import type { MechanismId } from "../values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { type WhyChain, whyChainSchema } from "../values/why-chain.ts";
import type { AuthorisedLocationEntry, ExceptionRecord, FileCarveOutEntry, InvalidRecord } from "./exception-record.ts";

export type {
  AuthorisationEvidence,
  AuthorisedLocationEntry,
  ClauseWideCarveOutEntry,
  ExceptionEntry,
  ExceptionRecord,
  ExceptionsFile,
  ExistingAuthorisationProvenance,
  FileCarveOutEntry,
  FileDebtEvidence,
  InheritedDebtProvenance,
  InvalidRecord,
} from "./exception-record.ts";

export type ExceptionReading = {
  readonly records: readonly ExceptionRecord[];
  readonly invalid: readonly InvalidRecord[];
};

export type ExceptionRepository = {
  readonly read: (request: {
    readonly selection: Selection;
    readonly baseline: ImportBaseline;
  }) => Result<ExceptionReading, LoadFailure>;
};

export const createExceptionRepository = (options: {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
}): ExceptionRepository => ({
  read: ({ selection, baseline }) => {
    const entries = readExceptionEntries(options);
    if (entries.outcome === "failed") return entries;
    return {
      outcome: "ok",
      value: parseExceptionEntries({ entries: entries.value, selection, baseline }),
    };
  },
});

export const createDefaultExceptionRepository = (options: {
  readonly repoRoot: AbsolutePath;
}): ExceptionRepository => createExceptionRepository({
  ...options,
  fileText: createDefaultFileTextPort({}),
  path: createDefaultPathPort({}),
});

type IndexedRecord = { readonly index: number; readonly record: ExceptionRecord };

type EntryProblem = InvalidRecord["problem"];

const exceptionsFileSchema = z.object({
  version: z.literal(1),
  exceptions: z.array(
    z.discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("authorised-location"),
        clause: z.string(),
        file: z.string(),
        reason: z.string(),
        whyChain: z.unknown().optional(),
        provenance: z.unknown().optional(),
      }),
      z.strictObject({
        kind: z.literal("file-carve-out"),
        clause: z.string(),
        file: z.string(),
        reason: z.string(),
        whyChain: z.unknown().optional(),
        provenance: z.unknown().optional(),
      }),
      z.strictObject({
        kind: z.literal("clause-wide-carve-out"),
        clause: z.string(),
        reason: z.string(),
        whyChain: z.unknown(),
      }),
    ]),
  ),
});

export type StructuralExceptionEntry = z.infer<typeof exceptionsFileSchema>["exceptions"][number];

export type ImportBaseline =
  | { readonly measured: "no" }
  | {
      readonly measured: "yes";
      readonly entriesAtBase: readonly StructuralExceptionEntry[];
      readonly sourceTextsAtBase: ReadonlyMap<RepoPath, string>;
    };

export const UNMEASURED_IMPORT_BASELINE: ImportBaseline = { measured: "no" };

const LEGACY_DIRECTORY_OF = {
  "inherited-debt": ".constitution-carve-outs",
  "existing-authorisation": ".constitution-authorised-locations",
} as const;

type ImportProvenanceKind = keyof typeof LEGACY_DIRECTORY_OF;

const LEGACY_SOURCE = /^(?<directory>[^/#]+)\/(?<stem>cd-[0-9a-z]+)\.json#(?<index>\d+)$/;

const legacySourceGroupsSchema = z.object({
  directory: z.enum([LEGACY_DIRECTORY_OF["inherited-debt"], LEGACY_DIRECTORY_OF["existing-authorisation"]]),
  stem: z.string(),
  index: z.coerce.number().int().nonnegative(),
});

const legacyRecordsSchema = z.array(z.looseObject({ files: z.array(z.string()) }));

type LegacySource = {
  readonly path: RepoPath;
  readonly directory: z.infer<typeof legacySourceGroupsSchema>["directory"];
  readonly discipline: string;
  readonly index: number;
};

const recordedTextSchema = z.string().refine((text) => text.trim().length > 0, { error: "must not be blank" });

const existingAuthorisationProvenanceSchema = z.strictObject({
  kind: z.literal("existing-authorisation"),
  source: recordedTextSchema,
  decision: recordedTextSchema.optional(),
});

const inheritedDebtProvenanceSchema = z.strictObject({
  kind: z.literal("inherited-debt"),
  source: recordedTextSchema,
  decision: recordedTextSchema,
});

const authorisedLocationFields = {
  kind: z.literal("authorised-location"),
  clause: z.string(),
  file: z.string(),
  reason: z.string(),
};

const authorisedLocationSchema: z.ZodType<AuthorisedLocationEntry> = z.union([
  z.strictObject({ ...authorisedLocationFields, whyChain: whyChainSchema, provenance: existingAuthorisationProvenanceSchema.optional() }),
  z.strictObject({ ...authorisedLocationFields, whyChain: z.never().optional(), provenance: existingAuthorisationProvenanceSchema }),
]);

const fileCarveOutFields = {
  kind: z.literal("file-carve-out"),
  clause: z.string(),
  file: z.string(),
  reason: z.string(),
};

const fileCarveOutSchema: z.ZodType<FileCarveOutEntry> = z.union([
  z.strictObject({ ...fileCarveOutFields, whyChain: whyChainSchema, provenance: inheritedDebtProvenanceSchema.optional() }),
  z.strictObject({ ...fileCarveOutFields, whyChain: z.never().optional(), provenance: inheritedDebtProvenanceSchema }),
]);

const legacySourceOf = (request: { readonly source: string }): LegacySource | "not-legacy-source" => {
  const groups = legacySourceGroupsSchema.safeParse(LEGACY_SOURCE.exec(request.source)?.groups);
  if (!groups.success) {
    return "not-legacy-source";
  }
  const path = repoPathSchema.safeParse(`${groups.data.directory}/${groups.data.stem}.json`);
  return path.success
    ? { path: path.data, directory: groups.data.directory, discipline: groups.data.stem.toUpperCase(), index: groups.data.index }
    : "not-legacy-source";
};

type ImportedIdentity = {
  readonly kind: "authorised-location" | "file-carve-out";
  readonly clause: string;
  readonly file: RepoPath;
};

const sameEntry = (request: {
  readonly left: StructuralExceptionEntry;
  readonly right: StructuralExceptionEntry;
}): "same" | "different" => (JSON.stringify(request.left) === JSON.stringify(request.right) ? "same" : "different");

const sameIdentity = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly identity: ImportedIdentity;
}): "same" | "different" =>
  request.entry.kind === request.identity.kind &&
  request.entry.clause === request.identity.clause &&
  request.entry.file === request.identity.file
    ? "same"
    : "different";

const legacyListing = (request: {
  readonly sourceTextsAtBase: ReadonlyMap<RepoPath, string>;
  readonly source: LegacySource;
  readonly file: RepoPath;
}): "listed" | "not-listed" => {
  const text = request.sourceTextsAtBase.get(request.source.path);
  const document = text === undefined ? undefined : parsedJson({ text });
  if (document === undefined || document.outcome === "failed") {
    return "not-listed";
  }
  const records = legacyRecordsSchema.safeParse(document.value);
  return records.success && records.data[request.source.index]?.files.includes(request.file) === true
    ? "listed"
    : "not-listed";
};

const importRefused = (request: { readonly detail: string }): Result<never, EntryProblem> => ({
  outcome: "failed",
  error: { kind: "import-unverified", detail: `${request.detail}: give it a whyChain` },
});

const verifiedImport = <ImportedRecord>(request: {
  readonly record: ImportedRecord;
  readonly entry: StructuralExceptionEntry;
  readonly identity: ImportedIdentity;
  readonly discipline: string;
  readonly provenance: { readonly kind: ImportProvenanceKind; readonly source: string };
  readonly baseline: ImportBaseline;
}): Result<ImportedRecord, EntryProblem> => {
  const { baseline } = request;
  if (baseline.measured === "no") {
    return { outcome: "ok", value: request.record };
  }
  if (baseline.entriesAtBase.some((baseEntry) => sameEntry({ left: baseEntry, right: request.entry }) === "same")) {
    return { outcome: "ok", value: request.record };
  }
  if (baseline.entriesAtBase.some((baseEntry) => sameIdentity({ entry: baseEntry, identity: request.identity }) === "same")) {
    return importRefused({ detail: "the imported record was edited since the base revision" });
  }
  const source = legacySourceOf({ source: request.provenance.source });
  const listed =
    source !== "not-legacy-source" &&
    source.directory === LEGACY_DIRECTORY_OF[request.provenance.kind] &&
    source.discipline === request.discipline.toUpperCase() &&
    legacyListing({ sourceTextsAtBase: baseline.sourceTextsAtBase, source, file: request.identity.file }) === "listed";
  return listed
    ? { outcome: "ok", value: request.record }
    : importRefused({
        detail: `the record is new since the base revision, and its provenance source ${request.provenance.source} is not an entry at the base revision listing ${request.identity.file} under ${LEGACY_DIRECTORY_OF[request.provenance.kind]}/${request.discipline.toLowerCase()}.json`,
      });
};

const recordedFile = (request: {
  readonly file: string;
}): Result<RepoPath, EntryProblem> => {
  const parsed = repoPathSchema.safeParse(request.file);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : { outcome: "failed", error: { kind: "file-not-repo-path", file: request.file } };
};

const recordedWhyChain = (request: {
  readonly whyChain: unknown;
}): Result<WhyChain, EntryProblem> => {
  const parsed = whyChainSchema.safeParse(request.whyChain);
  return parsed.success
    ? { outcome: "ok", value: parsed.data }
    : {
        outcome: "failed",
        error: { kind: "why-chain-refused", detail: z.prettifyError(parsed.error) },
      };
};

type ClauseSelection = { readonly clause: ClauseAddress; readonly mechanism: MechanismId };

const selectedClauseOf = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly selection: Selection;
}): Result<ClauseSelection, EntryProblem> => {
  const address = clauseAddressSchema.safeParse(request.entry.clause);
  if (!address.success) {
    return {
      outcome: "failed",
      error: { kind: "clause-unparseable", detail: z.prettifyError(address.error) },
    };
  }
  const clause = address.data;
  const selected = request.selection.selected.find((candidate) =>
    sameClauseAddress({ left: candidate.address, right: clause }) === "same",
  );
  if (selected === undefined) {
    return { outcome: "failed", error: { kind: "clause-not-selected", clause } };
  }
  if (selected.exceptions === "refused") {
    return { outcome: "failed", error: { kind: "non-exemptible-clause", clause } };
  }
  return { outcome: "ok", value: { clause, mechanism: selected.mechanism } };
};

const parsedRecord = (request: {
  readonly entry: StructuralExceptionEntry;
  readonly selection: Selection;
  readonly baseline: ImportBaseline;
}): Result<ExceptionRecord, EntryProblem> => {
  const { entry } = request;
  const selected = selectedClauseOf(request);
  if (selected.outcome === "failed") {
    return selected;
  }
  const { clause, mechanism } = selected.value;
  switch (entry.kind) {
    case "authorised-location": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      const evidence = authorisedLocationSchema.safeParse(entry);
      if (!evidence.success) {
        return { outcome: "failed", error: { kind: "evidence-refused", detail: z.prettifyError(evidence.error) } };
      }
      const record: ExceptionRecord = { ...evidence.data, clause, mechanism, file: file.value };
      return evidence.data.whyChain === undefined
        ? verifiedImport({
            record,
            entry,
            identity: { kind: entry.kind, clause: entry.clause, file: file.value },
            discipline: clause.discipline,
            provenance: evidence.data.provenance,
            baseline: request.baseline,
          })
        : { outcome: "ok", value: record };
    }
    case "file-carve-out": {
      const file = recordedFile({ file: entry.file });
      if (file.outcome === "failed") {
        return file;
      }
      const evidence = fileCarveOutSchema.safeParse(entry);
      if (!evidence.success) {
        const refusal = evidence.error.issues[0];
        const invalidChain = entry.whyChain !== undefined && refusal?.code === "invalid_union" &&
          refusal.errors[0]?.some((issue) => issue.path[0] === "whyChain");
        return {
          outcome: "failed",
          error: { kind: invalidChain ? "why-chain-refused" : "evidence-refused", detail: z.prettifyError(evidence.error) },
        };
      }
      const record: ExceptionRecord = { ...evidence.data, clause, mechanism, file: file.value };
      return evidence.data.whyChain === undefined
        ? verifiedImport({
            record,
            entry,
            identity: { kind: entry.kind, clause: entry.clause, file: file.value },
            discipline: clause.discipline,
            provenance: evidence.data.provenance,
            baseline: request.baseline,
          })
        : { outcome: "ok", value: record };
    }
    case "clause-wide-carve-out": {
      const whyChain = recordedWhyChain({ whyChain: entry.whyChain });
      if (whyChain.outcome === "failed") {
        return whyChain;
      }
      return {
        outcome: "ok",
        value: { kind: entry.kind, clause, mechanism, reason: entry.reason, whyChain: whyChain.value },
      };
    }
  }
};

type IdentityComparison = "same-identity" | "different-identity";

const identityComparison = (request: {
  readonly left: ExceptionRecord;
  readonly right: ExceptionRecord;
}): IdentityComparison => {
  const { left, right } = request;
  if (left.kind !== right.kind || sameClauseAddress({ left: left.clause, right: right.clause }) === "different") {
    return "different-identity";
  }
  switch (left.kind) {
    case "clause-wide-carve-out":
      return "same-identity";
    case "authorised-location":
    case "file-carve-out":
      return right.kind !== "clause-wide-carve-out" && left.file === right.file
        ? "same-identity"
        : "different-identity";
  }
};

const originalRecordOf = (request: {
  readonly valid: readonly IndexedRecord[];
  readonly candidate: IndexedRecord;
}): IndexedRecord | undefined =>
  request.valid.find(
    (earlier) =>
      earlier.index < request.candidate.index &&
      identityComparison({ left: earlier.record, right: request.candidate.record }) === "same-identity",
  );

type ParsedEntry = { readonly index: number; readonly record: Result<ExceptionRecord, EntryProblem> };

const validRecordsOf = (request: { readonly parsed: readonly ParsedEntry[] }): readonly IndexedRecord[] =>
  request.parsed.flatMap(({ index, record }): readonly IndexedRecord[] =>
    record.outcome === "ok" ? [{ index, record: record.value }] : [],
  );

const invalidRecordOf = (request: {
  readonly entry: ParsedEntry;
  readonly valid: readonly IndexedRecord[];
}): readonly InvalidRecord[] => {
  const { index, record } = request.entry;
  if (record.outcome === "failed") {
    return [{ index, problem: record.error }];
  }
  const original = originalRecordOf({ valid: request.valid, candidate: { index, record: record.value } });
  if (original === undefined) {
    return [];
  }
  return [{ index, problem: { kind: "duplicate", ofIndex: original.index } }];
};

const invalidRecordsOf = (request: {
  readonly parsed: readonly ParsedEntry[];
  readonly valid: readonly IndexedRecord[];
}): readonly InvalidRecord[] =>
  request.parsed.flatMap((entry) => invalidRecordOf({ entry, valid: request.valid }));

const firstRecordsOf = (request: { readonly valid: readonly IndexedRecord[] }): readonly ExceptionRecord[] =>
  request.valid
    .filter((candidate) => originalRecordOf({ valid: request.valid, candidate }) === undefined)
    .map(({ record }) => record);

export const parseExceptionEntries = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
  readonly selection: Selection;
  readonly baseline: ImportBaseline;
}): {
  readonly records: readonly ExceptionRecord[];
  readonly invalid: readonly InvalidRecord[];
} => {
  const parsed = request.entries.map(
    (entry, index): ParsedEntry => ({
      index,
      record: parsedRecord({ entry, selection: request.selection, baseline: request.baseline }),
    }),
  );
  const valid = validRecordsOf({ parsed });
  return { records: firstRecordsOf({ valid }), invalid: invalidRecordsOf({ parsed, valid }) };
};

export const readExceptionEntries = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
}): Result<readonly StructuralExceptionEntry[], LoadFailure> => {
  const path = request.path.join({ segments: [request.repoRoot, "discipline-exceptions.json"] });
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: [] };
  }
  const document = readVersionOneJson({ fileText: request.fileText, path });
  if (document.outcome === "failed") {
    return document;
  }
  const parsed = exceptionsFileSchema.safeParse(document.value);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "file-malformed", path, detail: z.prettifyError(parsed.error) },
    };
  }
  return { outcome: "ok", value: parsed.data.exceptions };
};

type ImportEvidence = { readonly imported: "no" } | { readonly imported: "yes"; readonly source: string };

const evidenceOf = (request: { readonly entry: StructuralExceptionEntry }) => {
  switch (request.entry.kind) {
    case "authorised-location":
      return authorisedLocationSchema.safeParse(request.entry);
    case "file-carve-out":
      return fileCarveOutSchema.safeParse(request.entry);
    case "clause-wide-carve-out":
      return undefined;
  }
};

const importEvidenceOf = (request: { readonly entry: StructuralExceptionEntry }): ImportEvidence => {
  const evidence = evidenceOf(request);
  if (evidence === undefined || !evidence.success || evidence.data.whyChain !== undefined) {
    return { imported: "no" };
  }
  return { imported: "yes", source: evidence.data.provenance.source };
};

const importSourcePathsOf = (request: { readonly entry: StructuralExceptionEntry }): readonly RepoPath[] => {
  const evidence = importEvidenceOf(request);
  if (evidence.imported === "no") {
    return [];
  }
  const source = legacySourceOf({ source: evidence.source });
  return source === "not-legacy-source" ? [] : [source.path];
};

export const importedEntriesIn = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): "present" | "absent" =>
  request.entries.some((entry) => importEvidenceOf({ entry }).imported === "yes") ? "present" : "absent";

export const importSourcesOf = (request: {
  readonly entries: readonly StructuralExceptionEntry[];
}): readonly RepoPath[] => [...new Set(request.entries.flatMap((entry) => importSourcePathsOf({ entry })))];

export const exceptionEntriesOfText = (request: { readonly text: string }): readonly StructuralExceptionEntry[] => {
  const document = parsedJson({ text: request.text });
  if (document.outcome === "failed") {
    return [];
  }
  const parsed = exceptionsFileSchema.safeParse(document.value);
  return parsed.success ? parsed.data.exceptions : [];
};
