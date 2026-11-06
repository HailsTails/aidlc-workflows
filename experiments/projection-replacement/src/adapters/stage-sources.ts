import { z } from "zod";
import { parseStageSource } from "./stage-source.ts";
import { createOwnershipDigest } from "./projection-ownership.ts";
import { createAuthoredSourceInventory } from "./authored-source-inventory.ts";
import type { StageSources } from "../domain/stage-definition.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import { finding, type Outcome } from "../domain/model.ts";
const inventory = z.array(z.strictObject({ path: z.string().regex(/^core\/aidlc-common\/stages\/[a-z]+\/[a-z][a-z0-9-]*\.md$/), text: z.string() })).min(1);
export type StageSourceReader = { readonly load: (input: { readonly sourceRoot: string; readonly basis: SourceBasis }) => Promise<Outcome<StageSources>> };
export type StageSourceOperations = { readonly inventory: (input: { readonly sourceRoot: string }) => Promise<unknown>; readonly digest: (input: { readonly bytes: Uint8Array }) => string };
export const createStageSourceOperations = (): StageSourceOperations => {
  const source = createAuthoredSourceInventory();
  return { digest: createOwnershipDigest(), inventory: ({ sourceRoot }) => source.read({ sourceRoot, directory: "core/aidlc-common/stages" }) };
};
const admitSources = ({ files, basis, operations }: { readonly files: z.infer<typeof inventory>; readonly basis: SourceBasis; readonly operations: StageSourceOperations }): Outcome<StageSources> => {
  if (new Set(files.map((file) => file.path)).size !== files.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "stage-sources", detail: "authored stages must have unique paths" })] };
  const parsed = files.map((file) => parseStageSource({ text: file.text, origin: { ...basis, path: file.path } }));
  const findings = parsed.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  const stages = parsed.flatMap((entry) => entry.status === "ok" ? [entry.value] : []);
  if (new Set(stages.map((stage) => stage.slug)).size !== stages.length) return { status: "invalid", findings: [finding({ code: "duplicate", subject: "stage-sources", detail: "authored stage slugs must be unique across phase directories" })] };
  return { status: "ok", value: { stages, inputs: files.map((file) => ({ path: file.path, sha256: operations.digest({ bytes: new TextEncoder().encode(file.text) }) })) } };
};
export const createStageSourceReader = ({ operations = createStageSourceOperations() }: { readonly operations?: StageSourceOperations } = {}): StageSourceReader => ({ load: async ({ sourceRoot, basis }) => {
  try { const parsed = inventory.safeParse(await operations.inventory({ sourceRoot })); return parsed.success ? admitSources({ files: parsed.data, basis, operations }) : { status: "invalid", findings: [finding({ code: "capability-gap", subject: "stage-sources", detail: "core stage projection requires nonempty native phase/slug Markdown inventory; unsupported entries were not dropped" })] }; }
  catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "stage-sources", detail: `authored stage inputs unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
} });
