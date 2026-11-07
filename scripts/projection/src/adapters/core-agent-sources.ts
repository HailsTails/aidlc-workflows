import { z } from "zod";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { parseAgentSource } from "./agent-source.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { CoreAgentSources } from "../domain/core-agent-sources.ts";
import { finding, type Outcome } from "../domain/model.ts";
const inventorySchema = z.array(z.strictObject({ path: z.string().regex(/^core\/agents\/[a-z][a-z0-9-]*-agent\.md$/), text: z.string().min(1) })).min(1);
export type CoreAgentSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly parse: typeof parseAgentSource; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type CoreAgentSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreAgentSources>> };
export const createCoreAgentSourceOperations = (): CoreAgentSourceOperations => {
  const source = createAuthoredSourceInventory();
  return { inventory: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/agents" }), parse: parseAgentSource, digest: createOwnershipDigest() };
};
const parseInventory = ({ rows, basis, operations }: { readonly rows: readonly { readonly path: string; readonly text: string }[]; readonly basis: SourceBasis; readonly operations: CoreAgentSourceOperations }): Outcome<CoreAgentSources> => {
  const parsed = rows.map((row) => operations.parse({ text: row.text, origin: { ...basis, path: row.path } }));
  const findings = parsed.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { agents: parsed.flatMap((entry) => entry.status === "ok" ? [entry.value] : []), inputs: rows.map((row) => ({ path: row.path, sha256: operations.digest({ bytes: new TextEncoder().encode(row.text) }) })) } };
};
const admitInventory = ({ candidate, basis, operations }: { readonly candidate: unknown; readonly basis: SourceBasis; readonly operations: CoreAgentSourceOperations }): Outcome<CoreAgentSources> => {
  const inventory = inventorySchema.safeParse(candidate);
  if (!inventory.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-sources", detail: "read a nonempty inventory of core/agents/<name>-agent.md; unsupported entries were not discarded" })] };
  if (new Set(inventory.data.map((row) => row.path)).size !== inventory.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "core-agent-sources", detail: "authored agent paths must be unique before parsing" })] };
  return parseInventory({ rows: inventory.data, basis, operations });
};
const admitAgentBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => basis.source.kind !== "core" || basis.source.id !== "framework" || basis.pin.trim().length === 0
  ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-agent-sources", detail: "declare the framework source basis before reading authored core agents" })] } : { status: "ok", value: basis };
const readAgentInventory = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreAgentSourceOperations }): Promise<Outcome<CoreAgentSources>> => {
  try { return admitInventory({ candidate: await operations.inventory({ sourceRoot }), basis, operations }); }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-sources", detail: "authored agent inventory or parser capability unavailable" })] }; }
};
const readAdmittedInventory = ({ admitted, sourceRoot, operations }: { readonly admitted: Outcome<SourceBasis>; readonly sourceRoot: string; readonly operations: CoreAgentSourceOperations }): Promise<Outcome<CoreAgentSources>> => admitted.status === "invalid" ? Promise.resolve(admitted) : readAgentInventory({ sourceRoot, basis: admitted.value, operations });
export const createCoreAgentSourceReader = ({ operations = createCoreAgentSourceOperations() }: { readonly operations?: CoreAgentSourceOperations } = {}): CoreAgentSourceReader => ({ load: ({ sourceRoot, basis }) => readAdmittedInventory({ admitted: admitAgentBasis({ basis }), sourceRoot, operations }) });
