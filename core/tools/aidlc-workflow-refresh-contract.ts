import type { StageRefreshComparisonPort, StageRevalidation } from "./aidlc-stage-refresh-contract.ts";

export type OpenWorkflowStage = { readonly workflow: string; readonly currentStage: string | null };
export type WorkflowContractSnapshot = {
  readonly stateVersion: string;
  readonly stages: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly scopes: Readonly<Record<string, unknown>>;
};
export type WorkflowRefreshPolicy = {
  readonly id: string;
  readonly compareStages: StageRefreshComparisonPort<string>;
  readonly notes: (args: { readonly stageRevalidation: StageRevalidation<string>; readonly openWorkflows: readonly OpenWorkflowStage[] }) => readonly string[];
};
export type WorkflowRefreshAssessment =
  | { readonly kind: "compatible"; readonly stageRevalidation: StageRevalidation<string> }
  | { readonly kind: "unproved"; readonly contract: "state-schema" | "stage" | "scope"; readonly name?: string };

export const sameContractValue = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameContractValue(entry, right[index]));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  const before = left as Record<string, unknown>;
  const after = right as Record<string, unknown>;
  return Object.keys(before).length === Object.keys(after).length && Object.keys(before).every((key) => Object.hasOwn(after, key) && sameContractValue(before[key], after[key]));
};

export const assessWorkflowRefresh = (args: {
  readonly installed: WorkflowContractSnapshot;
  readonly candidate: WorkflowContractSnapshot;
  readonly openWorkflows: readonly OpenWorkflowStage[];
  readonly compareStages: StageRefreshComparisonPort<string>;
}): WorkflowRefreshAssessment => {
  if (args.openWorkflows.length === 0) return { kind: "compatible", stageRevalidation: {} };
  if (args.installed.stateVersion !== args.candidate.stateVersion) return { kind: "unproved", contract: "state-schema" };
  const changes: Record<string, readonly string[]> = {};
  for (const [name, stage] of Object.entries(args.installed.stages)) {
    const compared = args.compareStages({ installed: stage, candidate: args.candidate.stages[name] });
    if (compared.kind !== "comparable" || !sameContractValue(compared.installed, compared.candidate)) return { kind: "unproved", contract: "stage", name };
    if (compared.revalidation.length > 0) changes[name] = compared.revalidation;
  }
  for (const [name, scope] of Object.entries(args.installed.scopes)) {
    if (!Object.hasOwn(args.candidate.scopes, name) || !sameContractValue(scope, args.candidate.scopes[name])) return { kind: "unproved", contract: "scope", name };
  }
  return { kind: "compatible", stageRevalidation: changes };
};
