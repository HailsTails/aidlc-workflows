import type { Timestamp } from "../../kernel/values.ts";
import type {
  AgentSlug,
  ArtifactName,
  StageSlug,
} from "../../workflow-definition/domain/identities.ts";
import type { ReviewClass } from "../../workflow-definition/domain/vocabulary.ts";
import type { UnitName } from "./identities.ts";

export type ReviewAttempt = {
  readonly stage: StageSlug;
  readonly unit: UnitName | null;
  readonly artifact: ArtifactName;
  readonly reviewer: AgentSlug;
  readonly reviewClass: Exclude<ReviewClass, "none">;
  readonly iteration: number;
  readonly requestedAt: Timestamp;
};

export type ReviewFindingStatus = "open" | "resolved" | "rejected" | "reopened";

export type ReviewFinding = {
  readonly id: string;
  readonly status: ReviewFindingStatus;
  readonly summary: string;
};

export type ReviewReceipt = {
  readonly attempt: ReviewAttempt;
  readonly verdict: "ready" | "not-ready";
  readonly findings: readonly ReviewFinding[];
  readonly receivedAt: Timestamp;
};
