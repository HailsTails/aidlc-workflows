import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceBasis, SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { Outcome } from "./model.ts";
export type StageCommandDraft = { readonly path: string; readonly source: string };
export type PreparedStageCommand = StageCommandDraft & { readonly text: string; readonly origins: readonly SourceOrigin[] };
export type NativeStageCommands = { readonly binding: HarnessBinding; readonly compiler: SourceOrigin; readonly inputs: readonly SourceContentDigest[]; readonly documents: readonly PreparedStageCommand[] };
export type NativeStageCommandRequest = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly documents: readonly StageCommandDraft[] };
export type NativeStageCommandPreparer = { readonly prepare: (input: NativeStageCommandRequest) => Outcome<NativeStageCommands> };
