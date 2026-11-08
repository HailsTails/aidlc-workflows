import { brand } from "../../kernel/brand.ts";
import type { Gate } from "./gate.ts";
import {
  CORE_GUARDS,
  type GuardDeclaration,
  type GuardId,
  type GuardRefusal,
} from "./guard.ts";
import { lockedIn } from "./guard-standing.ts";
import type { PlanApprovalStanding } from "./plan-approval.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";
import type { RecordMoveRefusal, StageAt, StageState } from "./workflow-record.ts";

export type GuardRule<Situation, Stop extends GuardRefusal | null = GuardRefusal | null> = {
  readonly declaration: GuardDeclaration;
  readonly check: (situation: Situation) => Stop;
};

export const ENGINE_NEXT_STEP = "Ask the engine for the next step and carry that out.";

export const placeOf = (at: StageAt): string =>
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

export const stateTransitionRule: GuardRule<RecordMoveRefusal, GuardRefusal> = {
  declaration: CORE_GUARDS.stateTransition,
  check: (refusal) =>
    lockedIn(
      {
        guard: CORE_GUARDS.stateTransition,
        reason: transitionReason(refusal),
        nextStep: ENGINE_NEXT_STEP,
      },
      "this work's record",
    ),
};

const REVIEW_RECEIPT: GuardDeclaration = {
  id: brand<GuardId>("review-receipt"),
  protects: "A review counts only when it is the one the engine asked for.",
  lift: { kind: "switch" },
};

export type ReceiptDelivery = {
  readonly receipt: ReviewReceipt;
  readonly requested: ReviewAttempt;
};

const receiptReason = (delivery: ReceiptDelivery): string | null => {
  const { reviewer, iteration } = delivery.receipt.attempt;
  const { requested } = delivery;
  if (reviewer !== requested.reviewer) {
    return `The engine asked ${requested.reviewer} for this review, not ${reviewer}.`;
  }
  return iteration === requested.iteration
    ? null
    : `The engine asked for review ${requested.iteration}, not review ${iteration}.`;
};

export const reviewReceiptRule: GuardRule<ReceiptDelivery> = {
  declaration: REVIEW_RECEIPT,
  check: (delivery) => {
    const reason = receiptReason(delivery);
    return reason === null ? null : { guard: REVIEW_RECEIPT, reason, nextStep: ENGINE_NEXT_STEP };
  },
};

export const gatePlace = (gate: Gate): string => {
  switch (gate.kind) {
    case "stage":
      return `the ${placeOf(gate)} gate`;
    case "plan-approval":
      return `the plan approval for ${placeOf(gate)}`;
    case "checkpoint":
      return `the ${gate.checkpoint.kind} checkpoint for Unit ${gate.checkpoint.unit}`;
  }
};

export type Unheard =
  | { readonly asked: "gate"; readonly gate: Gate; readonly heard: "unopened" | "absent" }
  | { readonly asked: "reopen" };

const unheardStop = (unheard: Unheard): Omit<GuardRefusal, "guard"> => {
  if (unheard.asked === "reopen") {
    return {
      reason: "The person has not asked, in this chat, to reopen this finished work.",
      nextStep: "Reopen it only when the person asks in their own words.",
    };
  }
  return unheard.heard === "absent"
    ? {
        reason: `No reply the person typed has reached ${gatePlace(unheard.gate)} since it opened.`,
        nextStep: "Wait for the person to type their choice, then record it.",
      }
    : {
        reason: `Nothing has put ${gatePlace(unheard.gate)} to the person yet.`,
        nextStep: "Ask the engine for the next step; it puts each gate to the person when it is due.",
      };
};

export const humanPresenceRule: GuardRule<Unheard, GuardRefusal> = {
  declaration: CORE_GUARDS.humanPresence,
  check: (unheard) => ({ guard: CORE_GUARDS.humanPresence, ...unheardStop(unheard) }),
};

export const planApprovalRule: GuardRule<PlanApprovalStanding> = {
  declaration: CORE_GUARDS.planApproval,
  check: (standing) => {
    switch (standing.kind) {
      case "approved":
        return null;
      case "stale":
        return {
          guard: CORE_GUARDS.planApproval,
          reason: `The plan for ${placeOf(standing.target)} changed since the person approved it.`,
          nextStep: "Ask the engine for the next step; it puts the plan to the person for approval.",
        };
      case "unapproved":
        return {
          guard: CORE_GUARDS.planApproval,
          reason: `${placeOf(standing.target)} has no plan the person approved.`,
          nextStep: "Ask the engine for the next step; it puts the plan to the person for approval.",
        };
    }
  },
};
