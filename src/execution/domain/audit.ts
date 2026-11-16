import type { Timestamp } from "../../kernel/values.ts";
import type { HookPoint } from "../../workflow-definition/domain/hooks.ts";
import type { Approval } from "./gate.ts";
import type { GuardRefusal, GuardSwitch } from "./guard.ts";
import type { AuditSequence, IntentId, SessionId } from "./identities.ts";
import type { ReviewReceipt } from "./review.ts";
import type { SessionBinding } from "./session.ts";
import type { Transition } from "./transition.ts";

export type AuditFact =
  | { readonly kind: "transition"; readonly transition: Transition }
  | { readonly kind: "gate-decided"; readonly approval: Approval }
  | { readonly kind: "guard-refused"; readonly refusal: GuardRefusal }
  | { readonly kind: "guard-switched"; readonly change: GuardSwitch }
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
