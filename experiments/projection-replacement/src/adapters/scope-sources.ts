import { z } from "zod";
import { parseScopeSource } from "./scope-source.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { createWorkflowSourceInventory } from "./workflow-source-inventory.ts";
import type { ScopeSources } from "../domain/scope-definition.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const inventory = z.array(z.strictObject({ path: z.string().regex(/^core\/scopes\/aidlc-[a-z][a-z0-9-]*\.md$/), text: z.string() })).min(1);
export type ScopeSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<ScopeSources>> };
export type ScopeSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export const createScopeSourceOperations = (): ScopeSourceOperations => {
  const source = createWorkflowSourceInventory();
  return { digest: createOwnershipDigest(), inventory: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/scopes" }) };
};
const admitSources = ({ files, basis, operations }: { readonly files: z.infer<typeof inventory>; readonly basis: SourceBasis; readonly operations: ScopeSourceOperations }): Outcome<ScopeSources> => {
  if (new Set(files.map((file) => file.path)).size !== files.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "scope-sources", detail: "authored scopes must have unique paths" })] };
  const parsed = files.map((file) => parseScopeSource({ text: file.text, origin: { ...basis, path: file.path } }));
  const findings = parsed.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { scopes: parsed.flatMap((entry) => entry.status === "ok" ? [entry.value] : []), inputs: files.map((file) => ({ path: file.path, sha256: operations.digest({ bytes: new TextEncoder().encode(file.text) }) })) } };
};
export const createScopeSourceReader = ({ operations = createScopeSourceOperations() }: { readonly operations?: ScopeSourceOperations } = {}): ScopeSourceReader => ({ load: async ({ sourceRoot, basis }) => {
  try { const parsed = inventory.safeParse(await operations.inventory({ sourceRoot })); return parsed.success ? admitSources({ files: parsed.data, basis, operations }) : { status: "invalid", findings: [finding({ code: "capability-gap", subject: "scope-sources", detail: "core scope projection requires a nonempty flat inventory of authored aidlc-<name>.md files; unsupported entries were not dropped" })] }; }
  catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "scope-sources", detail: `authored scope inputs unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
} });
