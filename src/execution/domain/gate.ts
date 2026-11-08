import type { ContentHash, Timestamp } from "../../kernel/values.ts";
import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { PlanFingerprint, SessionId, UnitName } from "./identities.ts";
import type { Checkpoint } from "./unit.ts";

export type Gate =
  | { readonly kind: "stage"; readonly stage: StageSlug; readonly unit: UnitName | null }
  | { readonly kind: "plan-approval"; readonly stage: StageSlug; readonly unit: UnitName }
  | { readonly kind: "checkpoint"; readonly checkpoint: Checkpoint };

export type GateDecision =
  | { readonly kind: "approve" }
  | { readonly kind: "request-changes"; readonly feedback: string }
  | { readonly kind: "skip" }
  | { readonly kind: "jump"; readonly to: StageSlug }
  | { readonly kind: "stop" };

export type HumanEvidenceSource = "host-hook" | "host-transcript";

export type HumanEvidence = {
  readonly session: SessionId;
  readonly observedAt: Timestamp;
  readonly source: HumanEvidenceSource;
  readonly turnDigest: ContentHash;
};

export type Approval = {
  readonly gate: Gate;
  readonly decision: GateDecision;
  readonly decidedAt: Timestamp;
  readonly evidence: HumanEvidence;
  readonly fingerprint: PlanFingerprint | null;
};
