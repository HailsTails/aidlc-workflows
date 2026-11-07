import type { HarnessBinding } from "./harness-binding.ts";
import type { SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { CompiledWorkflowSource } from "./workflow-compilation.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { Outcome } from "./model.ts";
import { renderWorkflowProse, type WorkflowProseContext } from "./workflow-prose.ts";
import { bindWorkflowSourceInputs } from "./workflow-source-inputs.ts";
export type AuthoredScope = { readonly origin: SourceOrigin; readonly name: string; readonly markdown: string };
export type ScopeSources = { readonly scopes: readonly AuthoredScope[]; readonly inputs: readonly SourceContentDigest[] };
export const bindScopeInputs = ({ sources, workflow }: { readonly sources: ScopeSources; readonly workflow: CompiledWorkflowSource }): Outcome<ScopeSources> => {
  const bound = bindWorkflowSourceInputs({ inputs: sources.inputs, workflow, directory: "core/scopes" });
  return bound.status === "invalid" ? bound : { status: "ok", value: sources };
};
export type ScopeContext = WorkflowProseContext;
export type ScopeProjection = { readonly origin: SourceOrigin; readonly name: string; readonly harness: HarnessBinding["harness"]; readonly resources: readonly NativeResource[] };
export const renderScopeDefinition = ({ scope, context }: { readonly scope: AuthoredScope; readonly context: ScopeContext }): Outcome<ScopeProjection> => {
  const path = `${context.directory}/scopes/aidlc-${scope.name}.md`;
  const projected = renderWorkflowProse({ markdown: scope.markdown, context, subject: path });
  return projected.status === "invalid" ? projected : { status: "ok", value: { origin: scope.origin, name: scope.name, harness: context.harness, resources: [{ kind: "file", path, body: projected.value }] } };
};
