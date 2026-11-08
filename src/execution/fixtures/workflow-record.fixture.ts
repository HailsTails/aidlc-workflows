import { accept } from "../../kernel/fixtures/accept.ts";
import { contentHash, type ContentHash, type Timestamp } from "../../kernel/values.ts";
import {
  scopeName,
  stageSlug,
  type StageSlug,
} from "../../workflow-definition/domain/identities.ts";
import type { ApprovalBasis, HumanEvidence } from "../domain/gate.ts";
import {
  intentId,
  intentSlug,
  recordVersion,
  sessionId,
  spaceName,
  unitName,
  type SessionId,
  type UnitName,
} from "../domain/identities.ts";
import type { StageState, WorkflowRecord } from "../domain/workflow-record.ts";

export const stageOf = (raw: string): StageSlug => accept(stageSlug(raw));

export const unitOf = (raw: string): UnitName => accept(unitName(raw));

export const sessionOf = (raw: string): SessionId => accept(sessionId(raw));

export const turnDigestOf = (raw: string): ContentHash => accept(contentHash(raw));

export const CHAT = sessionOf("5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35");

export const OTHER_CHAT = sessionOf("9a0b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d");

export const TURN_DIGEST = turnDigestOf(
  "sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5",
);

export const typedTurn = (observedAt: Timestamp): HumanEvidence => ({
  session: CHAT,
  observedAt,
  source: "host-hook",
  turnDigest: TURN_DIGEST,
});

export const heardAt = (observedAt: Timestamp): ApprovalBasis => ({
  kind: "human",
  evidence: typedTurn(observedAt),
});

export const STAGES_AT_REQUIREMENTS_GATE: readonly StageState[] = [
  { stage: stageOf("workspace-detection"), unit: null, progress: "completed" },
  { stage: stageOf("requirements-analysis"), unit: null, progress: "awaiting-approval" },
  { stage: stageOf("application-design"), unit: null, progress: "pending" },
  { stage: stageOf("code-generation"), unit: unitOf("payments-api"), progress: "pending" },
  { stage: stageOf("code-generation"), unit: unitOf("ledger"), progress: "pending" },
];

export const RUNNING_RECORD: WorkflowRecord = {
  id: accept(intentId("261108-checkout-flow")),
  slug: accept(intentSlug("checkout-flow")),
  space: accept(spaceName("default")),
  scope: accept(scopeName("feature")),
  version: accept(recordVersion(3)),
  status: { kind: "running" },
  settings: {
    depth: "standard",
    constructionAutonomy: "gated",
    guardPolicy: "strict",
    ceremony: {
      sensors: "on",
      learnings: "on",
      "summary-confirmation": "on",
      "plan-approval": "on",
      collaborators: "on",
    },
    reviewOverride: null,
  },
  stages: STAGES_AT_REQUIREMENTS_GATE,
  units: null,
  checkpoints: [],
  blockingChecks: [],
  approvals: [],
  reviews: [],
  guardSwitches: [],
};
