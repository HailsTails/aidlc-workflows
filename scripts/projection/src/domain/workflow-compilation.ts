import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceBasis, SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { Outcome } from "./model.ts";
export type WorkflowSourceLocation = { readonly sourceRoot: string; readonly contextRoot: string; readonly basis: SourceBasis; readonly binding: HarnessBinding };
export type CompiledWorkflowSource = { readonly binding: HarnessBinding; readonly compiler: SourceOrigin; readonly graph: { readonly origin: SourceOrigin; readonly text: string }; readonly grid: { readonly origin: SourceOrigin; readonly text: string }; readonly inputs: readonly SourceContentDigest[] };
export type WorkflowSourceCompiler = { readonly compile: (input: { readonly location: WorkflowSourceLocation }) => Outcome<CompiledWorkflowSource> };
