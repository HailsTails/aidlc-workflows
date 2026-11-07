import { z } from "zod";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { AuthoredMethodDocument, CoreMethodSources } from "../domain/core-method.ts";
import { finding, pathStatus, type Outcome } from "../domain/model.ts";
const methodPath = z.string().startsWith("core/memory/").refine((path) => pathStatus({ path }) === "safe");
const prose = z.strictObject({ path: methodPath.endsWith(".md"), bytes: z.instanceof(Uint8Array) }).transform((entry) => ({ kind: "prose" as const, ...entry }));
const marker = z.strictObject({ path: methodPath.endsWith("/.gitkeep"), bytes: z.instanceof(Uint8Array) }).transform((entry) => ({ kind: "directory-marker" as const, ...entry }));
const inventorySchema = z.array(z.union([prose, marker])).min(1);
export type CoreMethodSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type CoreMethodSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreMethodSources>> };
export const createCoreMethodSourceOperations = (): CoreMethodSourceOperations => {
  const inventory = createAuthoredSourceInventory();
  return { inventory: ({ sourceRoot }) => inventory.read({ sourceRoot, directory: "core/memory", encoding: "bytes" }), digest: createOwnershipDigest() };
};
const authoredMethod = ({ entry, basis }: { readonly entry: z.infer<typeof inventorySchema>[number]; readonly basis: SourceBasis }): Outcome<AuthoredMethodDocument> => {
  const placement = { relativePath: entry.path.slice("core/memory/".length), origin: { ...basis, path: entry.path } };
  if (entry.kind === "directory-marker") return { status: "ok", value: { ...placement, kind: "directory-marker", bytes: entry.bytes } };
  try { return { status: "ok", value: { ...placement, kind: "prose", text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(entry.bytes) } }; }
  catch { return { status: "invalid", findings: [finding({ code: "invalid-input", subject: entry.path, detail: "authored method Markdown must contain valid UTF-8; no replacement characters were introduced" })] }; }
};
const admitMethodInventory = ({ candidate, basis, operations }: { readonly candidate: unknown; readonly basis: SourceBasis; readonly operations: CoreMethodSourceOperations }): Outcome<CoreMethodSources> => {
  const inventory = inventorySchema.safeParse(candidate);
  if (!inventory.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-method-sources", detail: "read a nonempty byte inventory of safe core/memory Markdown and .gitkeep files; unsupported entries were not discarded" })] };
  if (new Set(inventory.data.map((entry) => entry.path)).size !== inventory.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "core-method-sources", detail: "authored method paths must be unique before delivery preparation" })] };
  const documents = inventory.data.map((entry) => authoredMethod({ entry, basis }));
  const findings = documents.flatMap((document) => document.status === "invalid" ? document.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { basis, documents: documents.flatMap((document) => document.status === "ok" ? [document.value] : []), inputs: inventory.data.map((entry) => ({ path: entry.path, sha256: operations.digest({ bytes: entry.bytes }) })) } };
};
const readMethodInventory = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreMethodSourceOperations }): Promise<Outcome<CoreMethodSources>> => {
  try { return admitMethodInventory({ candidate: await operations.inventory({ sourceRoot }), basis, operations }); }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-method-sources", detail: "authored method inventory unavailable" })] }; }
};
export const createCoreMethodSourceReader = ({ operations = createCoreMethodSourceOperations() }: { readonly operations?: CoreMethodSourceOperations } = {}): CoreMethodSourceReader => ({ load: ({ sourceRoot, basis }) => {
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || !/^[a-f0-9]{40}$/.test(basis.pin)) return Promise.resolve({ status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-method-sources", detail: "declare the framework source and full source pin before reading authored method files" })] });
  return readMethodInventory({ sourceRoot, basis, operations });
} });
