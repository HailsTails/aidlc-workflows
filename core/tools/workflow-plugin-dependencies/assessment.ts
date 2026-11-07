export type WorkflowLifecycle = "completed" | "archived" | "other";
export type Progress = "completed" | "skipped" | "other";
export interface WorkflowIdentity { readonly space: string; readonly name: string | null; readonly displayName: string }
export interface WorkflowState {
  readonly lifecycle: WorkflowLifecycle;
  readonly scope: string | null;
  readonly stages: readonly { readonly name: string; readonly progress: Progress; readonly action: "execute" | "other" }[];
}
export interface WorkflowCandidate {
  readonly identity: WorkflowIdentity;
  readonly lifecycle: WorkflowLifecycle;
  /** Invoked only when this workflow can still impose requirements. */
  readonly readState: (name: string) => WorkflowState | null;
}
export interface OwnershipDeclarations {
  readonly scopes: readonly { readonly name: string; readonly plugin?: string | undefined }[];
  readonly stages: readonly { readonly name: string; readonly phase: "initialization" | "other"; readonly plugin?: string | undefined }[];
}
/** Source acquisition is outside policy; visit order is the reason order. */
export interface DependencySource {
  readonly ownership: () => OwnershipDeclarations;
  readonly visitWorkflows: (visit: (candidate: WorkflowCandidate) => void) => void;
}
export type DependencyReason = {
  readonly plugin: string;
  readonly workflow: WorkflowIdentity;
} & ({ readonly kind: "scope"; readonly scope: string } | { readonly kind: "stage"; readonly stage: string });

/**
 * A workflow needs its scope and each unfinished executable stage. Terminal
 * registry/state records and unnamed or absent state cannot impose obligations.
 * Initialization is universally available. A declaration with an omitted/null
 * owner defaults to core; absent declarations and empty owners impose no
 * constraint. A named plugin still requires availability. Availability is authoritative
 * even for core. Last declarations win; repeated reasons are never merged.
 * Source errors propagate at the read that failed; no later workflow is observed.
 */
export function assessDependencies(source: DependencySource, available: ReadonlySet<string>): DependencyReason[] {
  const declarations = source.ownership();
  const scopes = new Map(declarations.scopes.map((item) => [item.name, item.plugin ?? "aidlc"]));
  const stages = new Map(declarations.stages.filter((item) => item.phase !== "initialization").map((item) => [item.name, item.plugin ?? "aidlc"]));
  const reasons: DependencyReason[] = [];
  source.visitWorkflows((candidate) => {
    if (candidate.lifecycle === "completed" || candidate.lifecycle === "archived" || !candidate.identity.name) return;
    const state = candidate.readState(candidate.identity.name);
    if (!state || state.lifecycle === "completed" || state.lifecycle === "archived") return;
    const workflow = candidate.identity;
    const scopeOwner = state.scope ? scopes.get(state.scope) : undefined;
    if (state.scope && scopeOwner && !available.has(scopeOwner)) reasons.push({ kind: "scope", plugin: scopeOwner, workflow, scope: state.scope });
    state.stages.forEach((stage) => {
      if (stage.progress === "completed" || stage.progress === "skipped" || stage.action !== "execute") return;
      const plugin = stages.get(stage.name);
      if (plugin && !available.has(plugin)) reasons.push({ kind: "stage", plugin, workflow, stage: stage.name });
    });
  });
  return reasons;
}
