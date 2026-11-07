import type { AuthoredProseContext } from "./authored-prose.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { SourceBasis, SourceContentDigest } from "./source-origin.ts";
import type { CompiledWorkflowSource } from "./workflow-compilation.ts";
import type { WorkflowAuthoringPolicy } from "./workflow-prose.ts";
import type { Outcome } from "./model.ts";

export type WorkflowReferenceRequest = {
  readonly sourceRoot: string;
  readonly root: string;
  readonly basis: SourceBasis;
  readonly context: AuthoredProseContext;
  readonly workflow: CompiledWorkflowSource;
  readonly authoring: WorkflowAuthoringPolicy;
  readonly scopeFiles: readonly NativeResource[];
};
export type PreparedWorkflowReference = { readonly file: NativeResource; readonly inputs: readonly SourceContentDigest[] };
export type WorkflowReferencePreparer = { readonly prepare: (request: WorkflowReferenceRequest) => Promise<Outcome<PreparedWorkflowReference>> };
