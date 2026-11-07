import type { HarnessBinding } from "./harness-binding.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { SourceBasis, SourceContentDigest } from "./source-origin.ts";
import type { Outcome } from "./model.ts";
export type DistributionContext = { readonly binding: HarnessBinding; readonly rulesSubdir: "rules" | "aidlc-rules" | "steering"; readonly invocation: string };
export type PreparedDistributionContext = { readonly context: DistributionContext; readonly files: readonly DistributionFile[]; readonly inputs: readonly SourceContentDigest[] };
export type DistributionContextLocation = { readonly location: { readonly sourceRoot: string; readonly root: string; readonly basis: SourceBasis }; readonly binding: HarnessBinding };
export type DistributionContextReader = { readonly load: (input: DistributionContextLocation) => Promise<Outcome<PreparedDistributionContext>> };
