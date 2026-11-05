import { z } from "zod";
import type { ProjectionOwnership, OwnedProductRecord, OwnershipDigest } from "../domain/projection-ownership.ts";
import { finding, pathStatus, sourceKey, type Outcome } from "../domain/model.ts";
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const source = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("core"), id: slug }), z.strictObject({ kind: z.literal("plugin"), id: slug })]);
const basis = z.strictObject({ source, pin: z.string().min(1) });
const path = z.string().refine((path) => pathStatus({ path }) === "safe");
const binding = z.discriminatedUnion("harness", [z.strictObject({ harness: z.literal("claude"), directory: z.literal(".claude") }), z.strictObject({ harness: z.literal("cursor"), directory: z.literal(".cursor") }), z.strictObject({ harness: z.literal("codex"), directory: z.literal(".codex") }), z.strictObject({ harness: z.literal("copilot"), directory: z.literal(".aidlc") }), z.strictObject({ harness: z.literal("opencode"), directory: z.literal(".aidlc") }), z.strictObject({ harness: z.literal("kiro"), directory: z.literal(".kiro") }), z.strictObject({ harness: z.literal("kiro-ide"), directory: z.literal(".kiro") })]);
const product = z.strictObject({ key: slug, owner: basis, binding, inputs: z.array(basis.extend({ path })), requiredByProducer: z.array(path), files: z.array(z.strictObject({ path, mode: z.number().int().min(0).max(0o777), sha256: z.string().regex(/^[a-f0-9]{64}$/) })).min(1) });
const schema = z.strictObject({ schemaVersion: z.literal(1), binding, products: z.array(product) });
const recordKey = ({ record }: { readonly record: OwnedProductRecord }): string => `${sourceKey(record.owner.source)}/${record.key}`;
const decodeOwnership = ({ document }: { readonly document: unknown }): Outcome<ProjectionOwnership> => {
  const parsed = schema.safeParse(document);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "projection-ownership", detail: "ownership requires version 1, exact harness binding, safe paths, source provenance and SHA-256 file records" })] };
  const records = parsed.data.products, keys = records.map((record) => recordKey({ record })), paths = records.flatMap((record) => record.files.map((file) => file.path));
  if (new Set(keys).size !== keys.length || new Set(paths).size !== paths.length || records.some((record) => record.binding.harness !== parsed.data.binding.harness || record.binding.directory !== parsed.data.binding.directory))
    return { status: "invalid", findings: [finding({ code: "destination-collision", subject: "projection-ownership", detail: "ownership requires unique product identities and file paths within one harness binding" })] };
  return { status: "ok", value: parsed.data };
};
export type ProjectionOwnershipCodec = { readonly read: (input: { readonly json: string }) => Outcome<ProjectionOwnership>; readonly write: (input: { readonly ownership: ProjectionOwnership }) => string };
export const createProjectionOwnershipCodec = (): ProjectionOwnershipCodec => ({
  read: ({ json }) => {
    try { const document: unknown = JSON.parse(json); return decodeOwnership({ document }); }
    catch { return { status: "invalid", findings: [finding({ code: "invalid-input", subject: "projection-ownership", detail: "ownership must be valid JSON" })] }; }
  },
  write: ({ ownership }) => `${JSON.stringify(ownership, null, 2)}\n`,
});
export const createOwnershipDigest = (): OwnershipDigest => ({ bytes }) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
