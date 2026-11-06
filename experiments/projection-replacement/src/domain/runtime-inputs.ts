import type { SourceContentDigest, SourceBasis } from "./source-origin.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import type { Outcome } from "./model.ts";
export type PreparedInputEvidence = { readonly paths: readonly string[]; readonly inputs: readonly SourceContentDigest[] };
export type RuntimeInputPreparation = PreparedInputEvidence & { readonly kind: "context" | "runtime-assets" | "runtime-contracts" | "runtime-modules" | "plugin-authoring" | "distribution-metadata" | "harness-settings" | "workspace-seed" };
export type PreparedRuntimeInput = { readonly files: readonly DistributionFile[]; readonly preparation: RuntimeInputPreparation };
export type RuntimeInputRequest = { readonly sourceRoot: string; readonly root: string; readonly invocation?: string; readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly mode: number };
export type RuntimeInputPreparer = { readonly prepare: (input: RuntimeInputRequest) => Promise<Outcome<PreparedRuntimeInput>> };
export const collectRuntimeInputEvidence = ({ preparations = [] }: { readonly preparations?: readonly RuntimeInputPreparation[] }): PreparedInputEvidence => ({ paths: preparations.flatMap((preparation) => preparation.paths), inputs: preparations.flatMap((preparation) => preparation.inputs) });
export const runtimeContextInputEvidence = ({ preparations = [] }: { readonly preparations?: readonly RuntimeInputPreparation[] }): PreparedInputEvidence | undefined => {
  const context = preparations.find((preparation) => preparation.kind === "context");
  return context === undefined ? undefined : { paths: context.paths, inputs: context.inputs };
};
