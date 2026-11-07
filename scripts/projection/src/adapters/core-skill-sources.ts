import { z } from "zod";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { CoreSkillSources } from "../domain/core-skill-sources.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const inventory = z.array(z.strictObject({ path: z.string().regex(/^core\/skills\/[a-z][a-z0-9-]*\/SKILL\.md$/), text: z.string() })).min(1);
export type CoreSkillSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export type CoreSkillSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<CoreSkillSources>> };
export const createCoreSkillSourceOperations = (): CoreSkillSourceOperations => {
  const source = createAuthoredSourceInventory();
  return { inventory: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/skills" }), digest: createOwnershipDigest() };
};
const admitSkillInventory = ({ candidates, basis, operations }: { readonly candidates: unknown; readonly basis: SourceBasis; readonly operations: CoreSkillSourceOperations }): Outcome<CoreSkillSources> => {
  const parsed = inventory.safeParse(candidates);
  if (!parsed.success) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-skill-sources", detail: "authored core skills require a nonempty inventory of core/skills/<name>/SKILL.md; companion assets and unsupported entries were not dropped" })] };
  if (new Set(parsed.data.map((entry) => entry.path)).size !== parsed.data.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "core-skill-sources", detail: "authored skill paths must be unique" })] };
  return { status: "ok", value: { skills: parsed.data.map((entry) => ({ name: entry.path.slice("core/skills/".length, -"/SKILL.md".length), origin: { ...basis, path: entry.path }, text: entry.text })), inputs: parsed.data.map((entry) => ({ path: entry.path, sha256: operations.digest({ bytes: new TextEncoder().encode(entry.text) }) })) } };
};
const admitSkillBasis = ({ basis }: { readonly basis: SourceBasis }): Outcome<SourceBasis> => basis.source.kind !== "core" || basis.source.id !== "framework" || basis.pin.trim().length === 0
  ? { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-skill-sources", detail: "declare the authored framework source basis before reading core skills" })] } : { status: "ok", value: basis };
const readSkillInventory = async ({ sourceRoot, basis, operations }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly operations: CoreSkillSourceOperations }): Promise<Outcome<CoreSkillSources>> => {
  try { return admitSkillInventory({ candidates: await operations.inventory({ sourceRoot }), basis, operations }); }
  catch { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-skill-sources", detail: "authored core skill inputs unavailable; inspect the source inventory and content reader" })] }; }
};
const continueSkillRead = ({ admitted, consume }: { readonly admitted: Outcome<SourceBasis>; readonly consume: (basis: SourceBasis) => Promise<Outcome<CoreSkillSources>> }): Promise<Outcome<CoreSkillSources>> => admitted.status === "invalid" ? Promise.resolve(admitted) : consume(admitted.value);
export const createCoreSkillSourceReader = ({ operations = createCoreSkillSourceOperations() }: { readonly operations?: CoreSkillSourceOperations } = {}): CoreSkillSourceReader => ({ load: ({ sourceRoot, basis }) => continueSkillRead({ admitted: admitSkillBasis({ basis }), consume: (knownBasis) => readSkillInventory({ sourceRoot, basis: knownBasis, operations }) }) });
