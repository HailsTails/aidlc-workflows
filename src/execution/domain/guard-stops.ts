import type { Gate } from "./gate.ts";
import { CORE_GUARDS, type GuardRefusal } from "./guard.ts";
import type { PlanApprovalStanding } from "./plan-approval.ts";
import type { RecordMoveRefusal, StageAt, StageState } from "./workflow-record.ts";

const ENGINE_NEXT_STEP = "Ask the engine for the next step and carry that out.";

const placeOf = (at: StageAt): string =>
  at.unit === null ? at.stage : `${at.stage} for Unit ${at.unit}`;

const stagesOf = (states: readonly StageState[]): string => states.map(placeOf).join(", ");

const transitionReason = (refusal: RecordMoveRefusal): string => {
  switch (refusal.kind) {
    case "workflow-status":
      return `This work is ${refusal.status.kind}; that step needs it ${refusal.needed}.`;
    case "stage-not-in-plan":
      return `${placeOf(refusal)} is not a stage this work runs.`;
    case "stage-out-of-order":
      return (
        `${placeOf(refusal.at)} is ${refusal.at.progress}; that step needs it ` +
        `${refusal.allowedFrom.join(" or ")}.`
      );
    case "stages-unfinished":
      return `These stages are not finished yet: ${stagesOf(refusal.remaining)}.`;
  }
};

export const transitionStop = (refusal: RecordMoveRefusal): GuardRefusal => ({
  guard: CORE_GUARDS.stateTransition,
  reason: transitionReason(refusal),
  nextStep: ENGINE_NEXT_STEP,
});

const gatePlace = (gate: Gate): string => {
  switch (gate.kind) {
    case "stage":
      return `the ${placeOf(gate)} gate`;
    case "plan-approval":
      return `the plan approval for ${placeOf(gate)}`;
    case "checkpoint":
      return `the ${gate.checkpoint.kind} checkpoint for Unit ${gate.checkpoint.unit}`;
  }
};

export const planApprovalStop = (
  standing: Exclude<PlanApprovalStanding, { readonly kind: "approved" }>,
): GuardRefusal => ({
  guard: CORE_GUARDS.planApproval,
  reason:
    standing.kind === "stale"
      ? `The plan for ${placeOf(standing.target)} changed since the person approved it.`
      : `${placeOf(standing.target)} has no plan the person approved.`,
  nextStep: "Ask the engine for the next step; it puts the plan to the person for approval.",
});

export const presenceStop = (gate: Gate): GuardRefusal => ({
  guard: CORE_GUARDS.humanPresence,
  reason: `No reply the person typed has reached ${gatePlace(gate)} since it opened.`,
  nextStep: "Wait for the person to type their choice, then record it.",
});
