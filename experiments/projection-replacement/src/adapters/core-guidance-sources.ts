import { z } from "zod";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { continuePreparation } from "../application/preparation-result.ts";
import type { CoreGuidanceSources } from "../domain/core-guidance.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const text = z.string().refine((text) => text.trim().length > 0);
const inventory = z.strictObject({ conductor: text, protocols: z.array(z.strictObject({ path: z.string().regex(/^core\/aidlc-common\/protocols\/[a-z][a-z0-9-]*\.md$/), text })).min(1) });
export type CoreGuidanceSourceOperations = { readonly conductor: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly protocols: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type CoreGuidanceSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreGuidanceSources>> };
export const createCoreGuidanceSourceOperations = (): CoreGuidanceSourceOperations => {
  const source = createAuthoredSourceInventory();
  return { conductor: source.conductor, protocols: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/aidlc-common/protocols" }), digest: createOwnershipDigest() };
};
const admitGuidanceInventory = ({ candidates, basis, operations }: { readonly candidates: unknown; readonly basis: SourceBasis; readonly operations: CoreGuidanceSourceOperations }): Outcome<CoreGuidanceSources> => {
  const parsed = inventory.safeParse(candidates);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-guidance-sources", detail: "guidance requires the nonempty authored conductor and core/aidlc-common/protocols/<slug>.md inventory; unsupported assets were not dropped" })] };
  if (new Set(parsed.data.protocols.map((entry) => entry.path)).size !== parsed.data.protocols.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "core-guidance-sources", detail: "authored protocol paths must be unique" })] };
  const conductor = { path: "core/aidlc-common/conductor.md", text: parsed.data.conductor };
  return { status: "ok", value: {
    documents: [{ placement: { kind: "conductor" }, origin: { ...basis, path: conductor.path }, text: conductor.text }, ...parsed.data.protocols.map((entry) => ({ placement: { kind: "protocol" as const, slug: entry.path.slice("core/aidlc-common/protocols/".length, -3) }, origin: { ...basis, path: entry.path }, text: entry.text }))],
    inputs: [conductor, ...parsed.data.protocols].map((entry) => ({ path: entry.path, sha256: operations.digest({ bytes: new TextEncoder().encode(entry.text) }) })),
  } };
};
const admitGuidanceBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => basis.source.kind !== "core" || basis.source.id !== "framework" || basis.pin.trim().length === 0
  ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-guidance-sources", detail: "declare the authored framework source basis before reading conductor and protocols" })] } : { status: "ok", value: basis };
const readGuidanceInventory = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreGuidanceSourceOperations }): Promise<Outcome<CoreGuidanceSources>> => {
  try {
    const [conductor, protocols] = await Promise.all([operations.conductor({ sourceRoot }), operations.protocols({ sourceRoot })]);
    return admitGuidanceInventory({ candidates: { conductor, protocols }, basis, operations });
  } catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-guidance-sources", detail: "authored guidance inputs unavailable; inspect conductor, protocol inventory and source reader" })] }; }
};
export const createCoreGuidanceSourceReader = ({ operations = createCoreGuidanceSourceOperations() }: { readonly operations?: CoreGuidanceSourceOperations } = {}): CoreGuidanceSourceReader => ({ load: ({ sourceRoot, basis }) => continuePreparation({ previous: admitGuidanceBasis({ basis }), consume: async ({ prepared }) => readGuidanceInventory({ sourceRoot, basis: prepared, operations }) }) });
