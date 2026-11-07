import { z } from "zod";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { CoreKnowledgeSources } from "../domain/core-knowledge-sources.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const inventory = z.array(z.strictObject({ path: z.string().regex(/^core\/knowledge\/[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*\.md$/), text: z.string().refine((text) => text.trim().length > 0) })).min(1);
export type CoreKnowledgeSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type CoreKnowledgeSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreKnowledgeSources>> };
export const createCoreKnowledgeSourceOperations = (): CoreKnowledgeSourceOperations => {
  const source = createAuthoredSourceInventory();
  return { inventory: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/knowledge" }), digest: createOwnershipDigest() };
};
const admitKnowledgeInventory = ({ candidates, basis, operations }: { readonly candidates: unknown; readonly basis: SourceBasis; readonly operations: CoreKnowledgeSourceOperations }): Outcome<CoreKnowledgeSources> => {
  const parsed = inventory.safeParse(candidates);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-knowledge-sources", detail: "authored core knowledge require a nonempty inventory of core/knowledge/<group>/<name>.md; companion assets and unsupported entries were not dropped" })] };
  if (new Set(parsed.data.map((entry) => entry.path)).size !== parsed.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "core-knowledge-sources", detail: "authored knowledge paths must be unique" })] };
  return { status: "ok", value: { documents: parsed.data.map((entry) => ({ relativePath: entry.path.slice("core/knowledge/".length), origin: { ...basis, path: entry.path }, text: entry.text })), inputs: parsed.data.map((entry) => ({ path: entry.path, sha256: operations.digest({ bytes: new TextEncoder().encode(entry.text) }) })) } };
};
const admitKnowledgeBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => basis.source.kind !== "core" || basis.source.id !== "framework" || basis.pin.trim().length === 0
  ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-knowledge-sources", detail: "declare the authored framework source basis before reading core knowledge" })] } : { status: "ok", value: basis };
const readKnowledgeInventory = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreKnowledgeSourceOperations }): Promise<Outcome<CoreKnowledgeSources>> => {
  try { return admitKnowledgeInventory({ candidates: await operations.inventory({ sourceRoot }), basis, operations }); }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-knowledge-sources", detail: "authored core knowledge inputs unavailable; inspect the source inventory and content reader" })] }; }
};
const continueKnowledgeRead = ({ admitted, consume }: { readonly admitted: Outcome<SourceBasis>; readonly consume: (basis: SourceBasis) => Promise<Outcome<CoreKnowledgeSources>> }): Promise<Outcome<CoreKnowledgeSources>> => admitted.status === "invalid" ? Promise.resolve(admitted) : consume(admitted.value);
export const createCoreKnowledgeSourceReader = ({ operations = createCoreKnowledgeSourceOperations() }: { readonly operations?: CoreKnowledgeSourceOperations } = {}): CoreKnowledgeSourceReader => ({ load: ({ sourceRoot, basis }) => continueKnowledgeRead({ admitted: admitKnowledgeBasis({ basis }), consume: (knownBasis) => readKnowledgeInventory({ sourceRoot, basis: knownBasis, operations }) }) });
