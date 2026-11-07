import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceBasis, SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { Outcome } from "./model.ts";
export type DocumentCommandDraft = { readonly path: string; readonly source: string };
export type PreparedDocumentCommand = DocumentCommandDraft & { readonly text: string; readonly origins: readonly SourceOrigin[] };
export type NativeDocumentCommands = { readonly binding: HarnessBinding; readonly compiler: SourceOrigin; readonly inputs: readonly SourceContentDigest[]; readonly documents: readonly PreparedDocumentCommand[] };
export type NativeDocumentCommandRequest = { readonly sourceRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding; readonly documents: readonly DocumentCommandDraft[] };
export type NativeDocumentCommandPreparer = { readonly prepare: (input: NativeDocumentCommandRequest) => Outcome<NativeDocumentCommands> };
