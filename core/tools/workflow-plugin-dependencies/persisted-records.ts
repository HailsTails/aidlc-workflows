import type { OwnershipDeclarations, WorkflowLifecycle, WorkflowState } from "./assessment.ts";

// Lexical decoding only: these exact spellings are the persisted format.
// Decoding a terminal/action/phase token does not decide eligibility or ownership.
export function decodeState(record: { readonly status: string; readonly scope: string | null; readonly rows: readonly { readonly slug: string; readonly state: string; readonly suffix: string }[] }): WorkflowState {
  const { status, scope, rows } = record;
  const lifecycle: WorkflowLifecycle = status === "Completed" ? "completed" : status === "Archived" ? "archived" : "other";
  return { lifecycle, scope, stages: rows.map((row) => ({
    name: row.slug,
    progress: row.state === "completed" ? "completed" : row.state === "skipped" ? "skipped" : "other",
    action: row.suffix.startsWith("EXECUTE") ? "execute" : "other",
  })) };
}
export function decodeOwnership(scopes: OwnershipDeclarations["scopes"], stages: readonly { readonly slug: string; readonly phase: string; readonly plugin?: string }[]): OwnershipDeclarations {
  return { scopes, stages: stages.map((stage) => ({ name: stage.slug, phase: stage.phase === "initialization" ? "initialization" : "other", plugin: stage.plugin })) };
}
