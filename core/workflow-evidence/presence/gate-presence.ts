import type { PresenceEvidence } from "./presence-evidence.ts";

export type GatePresenceRequirement =
  | { readonly kind: "human-required" }
  | { readonly kind: "autonomous"; readonly authority: "stage-definition" | "construction-grant" | "construction-policy" };

export type GatePresenceAdmission =
  | { readonly kind: "satisfied"; readonly evidence: PresenceEvidence }
  | {
      readonly kind: "not-required";
      readonly authority: "stage-definition" | "construction-grant" | "construction-policy";
      readonly evidence: PresenceEvidence;
    }
  | { readonly kind: "legacy-untracked-exemption"; readonly evidence: PresenceEvidence }
  | {
      readonly kind: "refused";
      readonly reason: "human-turn-missing" | "human-turn-consumed" | "ordering-unproven" | "ledger-unavailable";
      readonly evidence: PresenceEvidence;
    };

export const interpretGatePresence = ({
  evidence,
  requirement,
}: {
  readonly evidence: PresenceEvidence;
  readonly requirement: GatePresenceRequirement;
}): GatePresenceAdmission => {
  if (requirement.kind === "autonomous") {
    return { kind: "not-required", authority: requirement.authority, evidence };
  }
  switch (evidence.kind) {
    case "fresh":
      return { kind: "satisfied", evidence };
    case "untracked":
      return { kind: "legacy-untracked-exemption", evidence };
    case "missing":
      return { kind: "refused", reason: "human-turn-missing", evidence };
    case "consumed":
      return { kind: "refused", reason: "human-turn-consumed", evidence };
    case "unordered":
      return { kind: "refused", reason: "ordering-unproven", evidence };
    case "unavailable":
      return { kind: "refused", reason: "ledger-unavailable", evidence };
  }
};
