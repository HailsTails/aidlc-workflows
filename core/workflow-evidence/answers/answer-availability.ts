import type { PresenceEvidence } from "../presence/presence-evidence.ts";
import type { ReplyReuseEvidence } from "./reply-reuse.ts";

export type AnswerObservation = { readonly evidence: PresenceEvidence; readonly answerReuse: ReplyReuseEvidence };
export type AnswerAdmission =
  | { readonly kind: "admitted"; readonly basis: "fresh-reply" | "reused-reply"; readonly observation: AnswerObservation }
  | { readonly kind: "legacy-untracked-exemption"; readonly observation: AnswerObservation }
  | { readonly kind: "refused"; readonly reason: "ledger-unavailable" | "reply-unavailable" | "reuse-disabled"; readonly observation: AnswerObservation };

export const interpretAnswerAvailability = ({ observation, reusePermission }: {
  readonly observation: AnswerObservation;
  readonly reusePermission: "allowed" | "disabled";
}): AnswerAdmission => {
  if (observation.evidence.kind === "unavailable" || observation.answerReuse.kind === "unavailable") {
    return { kind: "refused", reason: "ledger-unavailable", observation };
  }
  if (observation.evidence.kind === "fresh") return { kind: "admitted", basis: "fresh-reply", observation };
  if (observation.evidence.kind === "untracked") return { kind: "legacy-untracked-exemption", observation };
  if (observation.evidence.kind !== "consumed" || observation.answerReuse.kind !== "reusable") return { kind: "refused", reason: "reply-unavailable", observation };
  if (reusePermission === "disabled") return { kind: "refused", reason: "reuse-disabled", observation };
  return { kind: "admitted", basis: "reused-reply", observation };
};
