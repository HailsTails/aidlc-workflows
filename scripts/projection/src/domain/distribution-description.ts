import type { RuntimeInputRequest, PreparedInputEvidence } from "./runtime-inputs.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { Outcome } from "./model.ts";
export type DistributionDescriptionRequest = RuntimeInputRequest & { readonly files: readonly string[]; readonly directories: readonly string[] };
export type PreparedDistributionDescription = { readonly files: readonly DistributionFile[]; readonly preparation: PreparedInputEvidence & { readonly kind: "distribution-metadata" } };
export type DistributionDescriptionPreparer = { readonly prepare: (input: DistributionDescriptionRequest) => Promise<Outcome<PreparedDistributionDescription>> };
export const claudeDistributionDescriptionPaths = (): readonly string[] => [".gitignore", ".mcp.json", ".claude/tools/data/root-blocks/gitignore", ".claude/tools/data/root-blocks/.mcp.json", ".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json"];
