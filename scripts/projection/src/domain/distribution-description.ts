import type { HarnessBinding } from "./harness-binding.ts";
import type { RuntimeInputRequest, PreparedInputEvidence } from "./runtime-inputs.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { SourceBasis, SourceContentDigest } from "./source-origin.ts";
import type { Tier } from "./model.ts";
import type { Outcome } from "./model.ts";
export type DistributionBuildProfile = { readonly buildVersion: string; readonly environmentCap: Tier | null };
export type PairedCopyDescription = { readonly profile: DistributionBuildProfile; readonly basis: SourceBasis; readonly files: readonly DistributionFile[]; readonly inputs: readonly SourceContentDigest[] };
export type DistributionDescriptionRequest = RuntimeInputRequest & { readonly files: readonly string[]; readonly directories: readonly string[]; readonly finalFiles?: readonly DistributionFile[] };
export type PreparedDistributionDescription = { readonly files: readonly DistributionFile[]; readonly preparation: PreparedInputEvidence & { readonly kind: "distribution-metadata" } };
export type DistributionDescriptionPreparer = { readonly prepare: (input: DistributionDescriptionRequest) => Promise<Outcome<PreparedDistributionDescription>> };
export const claudeDistributionDescriptionPaths = (): readonly string[] => [".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"];

export type DistributionDescriptionPaths = (binding: HarnessBinding) => readonly string[];
