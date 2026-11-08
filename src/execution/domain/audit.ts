import type { Timestamp } from "../../kernel/values.ts";
import type { HookPoint } from "../../workflow-definition/domain/hooks.ts";
import type { Approval } from "./gate.ts";
import type { GuardDeclaration, GuardRefusal, GuardSwitch } from "./guard.ts";
import type { StandAsideReason } from "./guard-standing.ts";
import type { AuditSequence, IntentId, SessionId } from "./identities.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";
import type { SessionBinding } from "./session.ts";
import type { Transition } from "./transition.ts";

export type AuditFact =
  | { readonly kind: "transition"; readonly transition: Transition }
  | { readonly kind: "gate-decided"; readonly approval: Approval }
  | { readonly kind: "guard-refused"; readonly refusal: GuardRefusal }
  | {
      readonly kind: "guard-stood-aside";
      readonly guard: GuardDeclaration;
      readonly because: StandAsideReason;
    }
  | { readonly kind: "guard-switched"; readonly change: GuardSwitch }
  | { readonly kind: "review-requested"; readonly attempt: ReviewAttempt }
  | { readonly kind: "review-recorded"; readonly receipt: ReviewReceipt }
  | { readonly kind: "session-bound"; readonly binding: SessionBinding }
  | { readonly kind: "host-event"; readonly point: HookPoint };

export type AuditEntry = {
  readonly intent: IntentId | null;
  readonly session: SessionId | null;
  readonly at: Timestamp;
  readonly causedBy: AuditSequence | null;
  readonly fact: AuditFact;
};

export type AuditEvent = AuditEntry & {
  readonly sequence: AuditSequence;
};

export const transitionFacts = (transitions: readonly Transition[]): readonly AuditFact[] =>
  transitions.map((transition) => ({ kind: "transition", transition }));

export const effectsOf = (
  events: readonly AuditEvent[],
  cause: AuditSequence,
): readonly AuditEvent[] => events.filter((event) => event.causedBy === cause);

const eventAt = (events: readonly AuditEvent[], sequence: AuditSequence): AuditEvent | undefined =>
  events.find((event) => event.sequence === sequence);

export const causeChain = (
  events: readonly AuditEvent[],
  effect: AuditEvent,
): readonly AuditEvent[] => {
  const cause = effect.causedBy === null ? undefined : eventAt(events, effect.causedBy);
  return cause === undefined ? [effect] : [...causeChain(events, cause), effect];
};

export type AuditIntegrity =
  | { readonly kind: "ordered" }
  | { readonly kind: "out-of-sequence"; readonly event: AuditEvent }
  | { readonly kind: "cause-not-earlier"; readonly event: AuditEvent };

const breakIn = (event: AuditEvent, earlier: AuditEvent | undefined): AuditIntegrity => {
  if (earlier !== undefined && event.sequence <= earlier.sequence) {
    return { kind: "out-of-sequence", event };
  }
  return event.causedBy !== null && event.causedBy >= event.sequence
    ? { kind: "cause-not-earlier", event }
    : { kind: "ordered" };
};

export const auditIntegrity = (events: readonly AuditEvent[]): AuditIntegrity =>
  events
    .map((event, position) => breakIn(event, events[position - 1]))
    .find((integrity) => integrity.kind !== "ordered") ?? { kind: "ordered" };
