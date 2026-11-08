import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { PlanFingerprint, UnitName } from "./identities.ts";
import { attemptStart, sinceAttemptStart } from "./review-attempt.ts";
import { appliedApprovals, type RecordedApproval, type WorkflowRecord } from "./workflow-record.ts";

export type PlanTarget = {
  readonly stage: StageSlug;
  readonly unit: UnitName;
  readonly current: PlanFingerprint;
};

export type PlanApprovalStanding =
  | { readonly kind: "approved"; readonly approval: RecordedApproval }
  | { readonly kind: "unapproved"; readonly target: PlanTarget }
  | { readonly kind: "stale"; readonly approval: RecordedApproval; readonly target: PlanTarget };

const decidesPlan = (approval: RecordedApproval, target: PlanTarget): "plan" | "other" =>
  approval.gate.kind === "plan-approval" &&
  approval.gate.stage === target.stage &&
  approval.gate.unit === target.unit
    ? "plan"
    : "other";

const approvedStanding = (approval: RecordedApproval, target: PlanTarget): PlanApprovalStanding =>
  approval.fingerprint === target.current
    ? { kind: "approved", approval }
    : { kind: "stale", approval, target };

export const planApprovalStanding = (
  record: WorkflowRecord,
  target: PlanTarget,
): PlanApprovalStanding => {
  const start = attemptStart(record, target);
  const latest = appliedApprovals(record)
    .filter(
      (approval) =>
        decidesPlan(approval, target) === "plan" &&
        sinceAttemptStart(approval.decidedAt, start) === "current",
    )
    .at(-1);
  return latest?.decision.kind === "approve"
    ? approvedStanding(latest, target)
    : { kind: "unapproved", target };
};
