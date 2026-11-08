import { accepted, type Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type { ApprovalBasis, Gate, GateDecision } from "./gate.ts";
import type { GuardRefusal } from "./guard.ts";
import type { PlanFingerprint } from "./identities.ts";
import { jumpToStage, reviseUnit, setStageProgress } from "./stage-progress.ts";
import type { Transition, TransitionCause } from "./transition.ts";
import type { Checkpoint } from "./unit.ts";
import {
  parkWorkflow,
  type DecisionOutcome,
  type RecordChange,
  type RecordedApproval,
  type RecordMoveRefusal,
  type StageProgress,
  type WorkflowRecord,
} from "./workflow-record.ts";

export type GateDecisionRequest = {
  readonly gate: Gate;
  readonly decision: GateDecision;
  readonly basis: ApprovalBasis;
  readonly fingerprint: PlanFingerprint | null;
  readonly time: Timestamp;
};

export type GateOutcome = {
  readonly record: WorkflowRecord;
  readonly transitions: readonly Transition[];
  readonly approval: RecordedApproval;
};

type SettlingDecision = Extract<GateDecision["kind"], "approve" | "request-changes" | "skip">;

type Settlement = {
  readonly decision: SettlingDecision;
  readonly cause: TransitionCause;
  readonly time: Timestamp;
};

type Moved = Result<RecordChange, RecordMoveRefusal>;

const DECIDED_PROGRESS: Readonly<Record<SettlingDecision, StageProgress>> = {
  approve: "completed",
  "request-changes": "revising",
  skip: "skipped",
};

const unchanged = (record: WorkflowRecord): Moved => accepted({ record, transitions: [] });

const settleStage = (
  record: WorkflowRecord,
  settlement: Settlement & { readonly gate: Extract<Gate, { kind: "stage" }> },
): Moved =>
  setStageProgress(record, {
    at: { stage: settlement.gate.stage, unit: settlement.gate.unit },
    to: DECIDED_PROGRESS[settlement.decision],
    cause: settlement.cause,
    time: settlement.time,
  });

const settlePlan = (
  record: WorkflowRecord,
  settlement: Settlement & { readonly gate: Extract<Gate, { kind: "plan-approval" }> },
): Moved =>
  settlement.decision === "skip"
    ? setStageProgress(record, {
        at: { stage: settlement.gate.stage, unit: settlement.gate.unit },
        to: "skipped",
        cause: settlement.cause,
        time: settlement.time,
      })
    : unchanged(record);

const sameCheckpoint = (checkpoint: Checkpoint, other: Checkpoint): "same" | "other" =>
  checkpoint.kind === other.kind && checkpoint.unit === other.unit ? "same" : "other";

const approveCheckpoint = (record: WorkflowRecord, approved: Checkpoint): Moved =>
  accepted({
    record: {
      ...record,
      checkpoints: record.checkpoints.map((checkpoint) =>
        sameCheckpoint(checkpoint, approved) === "same"
          ? { ...checkpoint, approval: "approved" }
          : checkpoint,
      ),
    },
    transitions: [],
  });

const settleCheckpoint = (
  record: WorkflowRecord,
  settlement: Settlement & { readonly gate: Extract<Gate, { kind: "checkpoint" }> },
): Moved => {
  const { checkpoint } = settlement.gate;
  switch (settlement.decision) {
    case "approve":
      return approveCheckpoint(record, checkpoint);
    case "request-changes":
      return reviseUnit(record, {
        unit: checkpoint.unit,
        stages: checkpoint.stages,
        cause: settlement.cause,
        time: settlement.time,
      });
    case "skip":
      return unchanged(record);
  }
};

const settle = (record: WorkflowRecord, settlement: Settlement & { readonly gate: Gate }): Moved => {
  const { gate } = settlement;
  switch (gate.kind) {
    case "stage":
      return settleStage(record, { ...settlement, gate });
    case "plan-approval":
      return settlePlan(record, { ...settlement, gate });
    case "checkpoint":
      return settleCheckpoint(record, { ...settlement, gate });
  }
};

const decisionMoves = (record: WorkflowRecord, request: GateDecisionRequest): Moved => {
  const { decision, time, gate } = request;
  const cause: TransitionCause = { kind: "person-decision", decision };
  switch (decision.kind) {
    case "stop":
      return parkWorkflow(record, time);
    case "jump":
      return jumpToStage(record, { to: decision.to, cause, time });
    case "approve":
    case "request-changes":
    case "skip":
      return settle(record, { decision: decision.kind, cause, time, gate });
  }
};

const approvalOf = (request: GateDecisionRequest, outcome: DecisionOutcome): RecordedApproval => ({
  gate: request.gate,
  decision: request.decision,
  decidedAt: request.time,
  basis: request.basis,
  fingerprint: request.fingerprint,
  outcome,
});

const recorded = (change: RecordChange, approval: RecordedApproval): GateOutcome => ({
  record: { ...change.record, approvals: [...change.record.approvals, approval] },
  transitions: change.transitions,
  approval,
});

export const decideAtGate = (
  record: WorkflowRecord,
  request: GateDecisionRequest,
): Result<GateOutcome, RecordMoveRefusal> => {
  const moved = decisionMoves(record, request);
  return moved.ok ? accepted(recorded(moved.value, approvalOf(request, { kind: "applied" }))) : moved;
};

export const keepUnapplied = (
  record: WorkflowRecord,
  kept: { readonly request: GateDecisionRequest; readonly refusal: GuardRefusal },
): GateOutcome =>
  recorded(
    { record, transitions: [] },
    approvalOf(kept.request, { kind: "recorded-not-applied", refusal: kept.refusal }),
  );
