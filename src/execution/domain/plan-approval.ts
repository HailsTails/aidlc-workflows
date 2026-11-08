import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { Approval } from "./gate.ts";
import type { PlanFingerprint, UnitName } from "./identities.ts";
import type { WorkflowRecord } from "./workflow-record.ts";

export type PlanTarget = {
  readonly stage: StageSlug;
  readonly unit: UnitName;
  readonly current: PlanFingerprint;
};

export type PlanApprovalStanding =
  | { readonly kind: "approved"; readonly approval: Approval }
  | { readonly kind: "unapproved"; readonly target: PlanTarget }
  | { readonly kind: "stale"; readonly approval: Approval; readonly target: PlanTarget };

type Bearing = "bears-on-plan" | "unrelated";

const planDecision = (approval: Approval, target: PlanTarget): Bearing =>
  approval.gate.kind === "plan-approval" &&
  approval.gate.stage === target.stage &&
  approval.gate.unit === target.unit
    ? "bears-on-plan"
    : "unrelated";

const newAttempt = (approval: Approval, target: PlanTarget): Bearing =>
  approval.gate.kind === "stage" &&
  approval.gate.stage === target.stage &&
  approval.gate.unit === target.unit &&
  approval.decision.kind !== "approve"
    ? "bears-on-plan"
    : "unrelated";

const bearing = (approval: Approval, target: PlanTarget): Bearing =>
  planDecision(approval, target) === "bears-on-plan" || newAttempt(approval, target) === "bears-on-plan"
    ? "bears-on-plan"
    : "unrelated";

const approvedStanding = (approval: Approval, target: PlanTarget): PlanApprovalStanding =>
  approval.fingerprint === target.current
    ? { kind: "approved", approval }
    : { kind: "stale", approval, target };

export const planApprovalStanding = (
  record: WorkflowRecord,
  target: PlanTarget,
): PlanApprovalStanding => {
  const latest = record.approvals
    .filter((approval) => bearing(approval, target) === "bears-on-plan")
    .at(-1);
  return latest?.gate.kind === "plan-approval" && latest.decision.kind === "approve"
    ? approvedStanding(latest, target)
    : { kind: "unapproved", target };
};
