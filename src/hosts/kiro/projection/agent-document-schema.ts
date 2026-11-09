import { z } from "zod";
import type { FileContent } from "../../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../../kernel/result.ts";

const fieldSchema = z.object({ name: z.string(), value: z.unknown() });
const fieldsSchema = z.array(fieldSchema);
const overflowSchema = z.union([z.literal(Infinity), z.literal(-Infinity)]);
const retainedSchema = z.unknown().transform((authoredValue) => ({ kind: "retained" as const, value: authoredValue }));

const objectFields = (authoredObject: unknown): unknown => {
  if (authoredObject === null || typeof authoredObject !== "object" || Array.isArray(authoredObject)) return undefined;
  return Object.entries(authoredObject).map(([name, entry]: [string, unknown]) => ({ name, value: entry }));
};

const fieldsAtEdge = z.preprocess(objectFields, fieldsSchema);
const commandSchema = fieldsAtEdge.transform((fields) => ({ fields,
  command: fields.find((field) => field.name === "command")?.value,
})).pipe(z.object({ fields: fieldsSchema, command: z.string() }))
  .transform((row) => ({ kind: "command" as const, ...row }));

const rowSchema = z.union([
  z.null().transform(() => ({ kind: "null-row" as const })),
  overflowSchema.transform((authoredValue) => ({ kind: "legacy-overflow-row" as const, value: authoredValue })),
  commandSchema,
  retainedSchema,
]);
const rowsSchema = z.union([
  z.array(rowSchema).transform((rows) => ({ kind: "rows" as const, rows })),
  z.string().transform((authoredValue) => ({ kind: "text-rows" as const, value: authoredValue })),
  z.unknown().transform(() => ({ kind: "invalid-rows" as const })),
]);
const namedRowsSchema = z.object({ name: z.string(), value: rowsSchema });
const objectHooksSchema = fieldsAtEdge.pipe(z.array(namedRowsSchema)).transform((groups) => ({
  kind: "object-hooks" as const, groups,
}));
const hooksSchema = z.union([
  z.undefined().transform(() => ({ kind: "absent-hooks" as const })),
  z.null().transform(() => ({ kind: "null-hooks" as const })),
  overflowSchema.transform((authoredValue) => ({ kind: "legacy-overflow-hooks" as const, value: authoredValue })),
  z.array(rowsSchema).transform((groups) => ({ kind: "array-hooks" as const, groups })),
  objectHooksSchema,
  z.union([z.string(), z.number(), z.boolean()])
    .transform((authoredValue) => ({ kind: "scalar-hooks" as const, value: authoredValue })),
]);
const resourceSchema = z.union([
  z.literal("file://.kiro/knowledge/aidlc-shared/*.md")
    .transform(() => ({ kind: "shared-glob" as const })),
  retainedSchema,
]);
const resourcesSchema = z.union([
  z.array(resourceSchema).transform((entries) => ({ kind: "resource-list" as const, entries })),
  z.unknown().transform(() => ({ kind: "other-resources" as const })),
]);
const objectDocumentSchema = fieldsAtEdge.transform((fields) => ({ fields,
  resources: fields.find((field) => field.name === "resources")?.value,
  hooks: fields.find((field) => field.name === "hooks")?.value,
})).pipe(z.object({ fields: fieldsSchema, resources: resourcesSchema, hooks: hooksSchema }))
  .transform((document) => ({ kind: "object" as const, ...document }));
const documentSchema = z.union([
  z.null().transform(() => ({ kind: "null" as const })),
  z.array(z.unknown()).transform((authoredValue) => ({ kind: "array" as const, value: authoredValue })),
  overflowSchema.transform((authoredValue) => ({ kind: "legacy-overflow" as const, value: authoredValue })),
  z.union([z.string(), z.number(), z.boolean()])
    .transform((authoredValue) => ({ kind: "scalar" as const, value: authoredValue })),
  objectDocumentSchema,
]);

export type KiroDocument = z.infer<typeof documentSchema>;
export type KiroField = z.infer<typeof fieldSchema>;
export type KiroHooks = z.infer<typeof hooksSchema>;
export type KiroHookRows = z.infer<typeof rowsSchema>;
export type KiroHookRow = z.infer<typeof rowSchema>;

export type KiroDocumentRefusal = {
  readonly kind: "kiro-json-invalid" | "kiro-document-invalid";
};

export const decodeKiroAgentDocument = (content: FileContent)
: Result<KiroDocument, KiroDocumentRefusal> => {
  const text = content.kind === "text" ? content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
  try {
    const decoded = documentSchema.safeParse(JSON.parse(text));
    return decoded.success ? accepted(decoded.data)
      : refused({ kind: "kiro-document-invalid" });
  } catch {
    return refused({ kind: "kiro-json-invalid" });
  }
};
