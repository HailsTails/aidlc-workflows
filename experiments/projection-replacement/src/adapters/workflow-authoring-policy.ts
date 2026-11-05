import { z } from "zod";
import { createOwnershipDigest } from "./projection-ownership.ts";
import type { WorkflowAuthoringPolicy, OptionLetters } from "../domain/workflow-prose.ts";
import type { SourceBasis } from "../domain/source-origin.ts";
import type { HarnessBinding } from "../domain/harness-binding.ts";
import { finding, type Outcome } from "../domain/model.ts";
const snapshotSchema = z.strictObject({ capability: z.enum(["declared", "absent"]), manifest: z.object({ name: z.string(), harnessDir: z.string(), questionOptions: z.number().int().min(2).max(5).optional() }), inputs: z.array(z.strictObject({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })) });
const moduleSchema = z.object({ default: z.unknown() });
const letters: Readonly<Record<number, OptionLetters>> = { 2: "A-B", 3: "A-C", 4: "A-D", 5: "A-E" };
export type WorkflowAuthoringLocation = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding };
export type WorkflowAuthoringOperations = { readonly snapshot: (input: WorkflowAuthoringLocation) => Promise<unknown> };
export type WorkflowAuthoringReader = { readonly load: (input: WorkflowAuthoringLocation) => Promise<Outcome<WorkflowAuthoringPolicy>> };
export const createWorkflowAuthoringOperations = (): WorkflowAuthoringOperations => {
  const digest = createOwnershipDigest();
  return { snapshot: async ({ sourceRoot, binding }) => {
    const paths = [`harness/${binding.harness}/manifest.ts`, "scripts/manifest-types.ts"];
    const texts = await Promise.all(paths.map((path) => Bun.file(`${sourceRoot}/${path}`).text()));
    const inputs = paths.map((path, index) => ({ path, sha256: digest({ bytes: new TextEncoder().encode(texts[index] ?? "") }) }));
    const imported: unknown = await import(`${Bun.pathToFileURL(`${sourceRoot}/${paths[0]}`).href}?source=${inputs[0]?.sha256}`);
    const after = await Promise.all(paths.map((path) => Bun.file(`${sourceRoot}/${path}`).text()));
    if (texts.some((text, index) => text !== after[index])) throw new Error("authoring manifest inputs changed during context preparation");
    return { capability: /^\s*questionOptions\?:\s*number\s*;/m.test(texts[1] ?? "") ? "declared" : "absent", manifest: moduleSchema.parse(imported).default, inputs };
  } };
};
const admitPolicy = ({ snapshot, location }: { readonly snapshot: z.infer<typeof snapshotSchema>; readonly location: WorkflowAuthoringLocation }): Outcome<WorkflowAuthoringPolicy> => {
  const expected = [`harness/${location.binding.harness}/manifest.ts`, "scripts/manifest-types.ts"];
  if (snapshot.manifest.name !== location.binding.harness || snapshot.manifest.harnessDir !== location.binding.directory || snapshot.inputs.length !== 2 || expected.some((path) => snapshot.inputs.filter((input) => input.path === path).length !== 1)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "workflow-authoring", detail: "authoring context requires the requested native manifest binding and both declared source witnesses" })] };
  if (snapshot.capability === "absent" && snapshot.manifest.questionOptions !== undefined) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "workflow-authoring", detail: "manifest questionOptions has no supported declaration in this source contract" })] };
  return { status: "ok", value: { binding: location.binding, optionLetters: snapshot.capability === "absent" ? null : letters[snapshot.manifest.questionOptions ?? 5] ?? null, origins: snapshot.inputs.map((input) => ({ ...location.basis, path: input.path })), inputs: snapshot.inputs } };
};
export const createWorkflowAuthoringReader = ({ operations = createWorkflowAuthoringOperations() }: { readonly operations?: WorkflowAuthoringOperations } = {}): WorkflowAuthoringReader => ({ load: async (location) => {
  try { const parsed = snapshotSchema.safeParse(await operations.snapshot(location)); return parsed.success ? admitPolicy({ snapshot: parsed.data, location }) : { status: "invalid", findings: [finding({ code: "invalid-input", subject: "workflow-authoring", detail: "authoring manifest context requires a supported binding, source digests and optional questionOptions from 2 to 5" })] }; }
  catch (error) { return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "workflow-authoring", detail: `authoring context unavailable: ${error instanceof Error ? error.message : String(error)}` })] }; }
} });
