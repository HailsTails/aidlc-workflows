import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import { renderAuthoredProse, type AuthoredProseContext, type OptionLetters } from "./authored-prose.ts";
export type { OptionLetters } from "./authored-prose.ts";
export type WorkflowAuthoringPolicy = { readonly binding: HarnessBinding; readonly optionLetters: OptionLetters | null; readonly origins: readonly SourceOrigin[]; readonly inputs: readonly SourceContentDigest[] };
export type WorkflowProseContext = AuthoredProseContext;
export const renderWorkflowProse = renderAuthoredProse;
