export interface WorkflowPluginFacts {
  readonly space: string;
  readonly recordName: string | null;
  readonly displayName: string;
  readonly registryClosed: boolean;
  readonly state: {
    readonly status: string;
    readonly scope: string | null;
    readonly stages: readonly {
      readonly slug: string;
      readonly state: string;
      readonly suffix: string;
    }[];
  } | null;
}

export interface WorkflowPluginOwnership {
  readonly scopes: readonly { readonly name: string; readonly plugin?: string }[];
  readonly stages: readonly { readonly slug: string; readonly phase: string; readonly plugin?: string }[];
}

export type WorkflowPluginDependency = {
  readonly plugin: string;
  readonly workflow: Pick<WorkflowPluginFacts, "space" | "recordName" | "displayName">;
} & (
  | { readonly kind: "scope"; readonly scope: string }
  | { readonly kind: "stage"; readonly stage: string }
);

export function workflowPluginDependencies(input: {
  readonly enabled: ReadonlySet<string>;
  readonly ownership: WorkflowPluginOwnership;
  readonly workflows: readonly WorkflowPluginFacts[];
}): WorkflowPluginDependency[] {
  const scopeOwners = new Map(input.ownership.scopes.map((scope) => [scope.name, scope.plugin ?? "aidlc"]));
  const stageOwners = new Map(input.ownership.stages
    .filter((stage) => stage.phase !== "initialization")
    .map((stage) => [stage.slug, stage.plugin ?? "aidlc"]));

  return input.workflows.flatMap((facts): WorkflowPluginDependency[] => {
    if (facts.registryClosed || !facts.recordName || facts.state === null) return [];
    if (facts.state.status === "Completed" || facts.state.status === "Archived") return [];
    const workflow = { space: facts.space, recordName: facts.recordName, displayName: facts.displayName };
    const scopeOwner = facts.state.scope ? scopeOwners.get(facts.state.scope) : undefined;
    const scopes: WorkflowPluginDependency[] = facts.state.scope && scopeOwner && !input.enabled.has(scopeOwner)
      ? [{ kind: "scope", plugin: scopeOwner, workflow, scope: facts.state.scope }]
      : [];
    const stages = facts.state.stages.flatMap((row): WorkflowPluginDependency[] => {
      if (row.state === "completed" || row.state === "skipped" || !row.suffix.startsWith("EXECUTE")) return [];
      const owner = stageOwners.get(row.slug);
      if (!owner || input.enabled.has(owner)) return [];
      return [{ kind: "stage", plugin: owner, workflow, stage: row.slug }];
    });
    return [...scopes, ...stages];
  });
}
