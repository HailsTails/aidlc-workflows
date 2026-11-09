import type { FileContent } from "../../../kernel/file-content.ts";
import type { HostIdentity } from "../../../kernel/host.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { SourcePath } from "../../../kernel/values.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import { decodeKiroAgentDocument, type KiroDocument, type KiroField,
  type KiroHookRow, type KiroHookRows, type KiroHooks, type KiroDocumentRefusal } from "./agent-document-schema.ts";
import { sharedKnowledgeResources } from "./shared-knowledge.ts";
import type { SharedKnowledge } from "../../../workflow-definition/domain/knowledge.ts";

export type KiroModelDecision =
  | { readonly kind: "preserve" }
  | { readonly kind: "project"; readonly model: string | undefined };

type KiroPreparationRefusal = KiroDocumentRefusal | {
  readonly kind: "kiro-model-null" | "kiro-model-scalar" | "kiro-resources-null"
    | "kiro-hook-rows-invalid" | "kiro-hook-row-null" | "kiro-hooks-null";
};

const REFUSAL_REASONS: Record<KiroPreparationRefusal["kind"], string> = {
  "kiro-json-invalid": "Kiro JSON decoding: the captured document is not valid JSON.",
  "kiro-document-invalid": "Kiro JSON decoding: the document structure could not be decoded.",
  "kiro-model-null": "Kiro model projection: the document cannot be null.",
  "kiro-model-scalar": "Kiro model projection: a model cannot be assigned to a scalar JSON value.",
  "kiro-resources-null": "Kiro shared-resource preparation: the document cannot be null.",
  "kiro-hook-rows-invalid": "Kiro hook preparation: hook groups need arrays or text.",
  "kiro-hook-row-null": "Kiro hook preparation: a hook row cannot be null.",
  "kiro-hooks-null": "Kiro hook preparation: a present hook collection cannot be null.",
};

type PreparedDocument = {
  readonly document: KiroDocument;
  readonly formatting: "original" | "pretty";
};

const replaceField = (fields: readonly KiroField[], replacement: KiroField): KiroField[] =>
  fields.some((field) => field.name === replacement.name)
    ? fields.map((field) => field.name === replacement.name ? replacement : field)
    : [...fields, replacement];

const modeledDocument = (document: KiroDocument, decision: KiroModelDecision)
: Result<PreparedDocument, KiroPreparationRefusal> => {
  if (decision.kind === "preserve") return accepted({ document, formatting: "original" });
  if (document.kind === "null") return refused({ kind: "kiro-model-null" });
  if (document.kind === "scalar" || document.kind === "legacy-overflow") {
    if (decision.model !== undefined) {
      return refused({ kind: "kiro-model-scalar" });
    }
    return accepted({ document, formatting: "pretty" });
  }
  if (document.kind === "array") return accepted({ document, formatting: "pretty" });
  const fields = decision.model === undefined
    ? document.fields.filter((field) => field.name !== "model")
    : replaceField(document.fields, { name: "model", value: decision.model });
  return accepted({ document: { ...document, fields }, formatting: "pretty" });
};

const expandedDocument = (prepared: PreparedDocument, knowledge: SharedKnowledge)
: Result<PreparedDocument, KiroPreparationRefusal> => {
  const document = prepared.document;
  const legacyFormattedOverflow = document.kind === "legacy-overflow"
    && prepared.formatting === "pretty";
  if (document.kind === "null" || legacyFormattedOverflow) {
    return refused({ kind: "kiro-resources-null" });
  }
  if (document.kind !== "object" || document.resources.kind !== "resource-list") {
    return accepted(prepared);
  }
  if (!document.resources.entries.some((entry) => entry.kind === "shared-glob")) {
    return accepted(prepared);
  }
  const files = sharedKnowledgeResources(knowledge);
  const expandedResources = document.resources.entries.flatMap<unknown>((entry) =>
    entry.kind === "shared-glob" ? files : [entry.value]);
  const fields = replaceField(document.fields, { name: "resources", value: expandedResources });
  return accepted({ document: { ...document, fields }, formatting: "pretty" });
};

type HookPreparation = {
  readonly suffix: string;
  readonly formatting: PreparedDocument["formatting"];
};

const collectEncodedHooks = (results: readonly Result<unknown, KiroPreparationRefusal>[])
: Result<unknown[], KiroPreparationRefusal> => results.reduce<Result<unknown[], KiroPreparationRefusal>>(
  (collected, encodedHook) => {
    if (!collected.ok) return collected;
    if (!encodedHook.ok) return encodedHook;
    return accepted([...collected.value, encodedHook.value]);
  }, accepted([]),
);

const encodedRow = (row: KiroHookRow, preparation: HookPreparation)
: Result<unknown, KiroPreparationRefusal> => {
  if (row.kind === "null-row"
    || (row.kind === "legacy-overflow-row" && preparation.formatting === "pretty")) {
    return refused({ kind: "kiro-hook-row-null" });
  }
  if (row.kind !== "command") return accepted(row.value);
  const fields = replaceField(row.fields, {
    name: "command", value: `${row.command}${preparation.suffix}`,
  });
  return accepted(Object.fromEntries(fields.map((field) => [field.name, field.value])));
};

const encodedRows = (rows: KiroHookRows, preparation: HookPreparation)
: Result<unknown, KiroPreparationRefusal> => {
  if (rows.kind === "invalid-rows") return refused({ kind: "kiro-hook-rows-invalid" });
  if (rows.kind === "text-rows") return accepted(rows.value);
  return collectEncodedHooks(rows.rows.map((row) => encodedRow(row, preparation)));
};

const encodedHooks = (hooks: KiroHooks, preparation: HookPreparation)
: Result<unknown, KiroPreparationRefusal> => {
  if (hooks.kind === "null-hooks"
    || (hooks.kind === "legacy-overflow-hooks" && preparation.formatting === "pretty")) {
    return refused({ kind: "kiro-hooks-null" });
  }
  if (hooks.kind === "absent-hooks") return accepted(undefined);
  if (hooks.kind === "array-hooks") {
    return collectEncodedHooks(hooks.groups.map((rows) => encodedRows(rows, preparation)));
  }
  if (hooks.kind !== "object-hooks") return accepted(hooks.value);
  return hooks.groups.reduce<Result<Record<string, unknown>, KiroPreparationRefusal>>(
    (collected, group) => {
      if (!collected.ok) return collected;
      const rows = encodedRows(group.value, preparation);
      if (!rows.ok) return rows;
      return accepted({ ...collected.value, [group.name]: rows.value });
    }, accepted({}),
  );
};

const hookedDocument = (prepared: PreparedDocument, suffix: string | undefined)
: Result<PreparedDocument, KiroPreparationRefusal> => {
  const document = prepared.document;
  if (suffix === undefined || document.kind !== "object" || document.hooks.kind === "absent-hooks") {
    return accepted(prepared);
  }
  const hooks = encodedHooks(document.hooks, { suffix, formatting: prepared.formatting });
  if (!hooks.ok) return hooks;
  const fields = replaceField(document.fields, {
    name: "hooks", value: hooks.value,
  });
  return accepted({ document: { ...document, fields }, formatting: "pretty" });
};

const encodedDocument = (document: KiroDocument): unknown => {
  if (document.kind === "null") return null;
  if (document.kind === "object") {
    return Object.fromEntries(document.fields.map((field) => [field.name, field.value]));
  }
  return document.value;
};

type HostSourceRefusal = Extract<ProjectionRefusal, { readonly kind: "host-source-unreadable" }>;

export const prepareKiroAgentDocument = (request: {
  readonly host: HostIdentity;
  readonly source: SourcePath;
  readonly content: FileContent;
  readonly model: KiroModelDecision;
  readonly knowledge: SharedKnowledge;
  readonly hookCommandSuffix: string | undefined;
}): Result<FileContent, HostSourceRefusal> => {
  const failure = (refusal: KiroPreparationRefusal): Result<FileContent, HostSourceRefusal> => refused({
    kind: "host-source-unreadable", host: request.host, source: request.source, reason: REFUSAL_REASONS[refusal.kind],
  });
  const decoded = decodeKiroAgentDocument(request.content);
  if (!decoded.ok) return failure(decoded.refusal);
  const modeled = modeledDocument(decoded.value, request.model);
  if (!modeled.ok) return failure(modeled.refusal);
  const expanded = expandedDocument(modeled.value, request.knowledge);
  if (!expanded.ok) return failure(expanded.refusal);
  const prepared = hookedDocument(expanded.value, request.hookCommandSuffix);
  if (!prepared.ok) return failure(prepared.refusal);
  if (prepared.value.formatting === "original") return accepted(request.content);
  return accepted({ kind: "text",
    text: `${JSON.stringify(encodedDocument(prepared.value.document), null, 2)}\n` });
};
