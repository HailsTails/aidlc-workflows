import type { Timestamp } from "../../kernel/values.ts";
import type { ScopeName, StageSlug } from "../../workflow-definition/domain/identities.ts";
import type {
  CeremonyKey,
  CeremonySwitch,
  Depth,
  GuardPolicy,
  ReviewClass,
} from "../../workflow-definition/domain/vocabulary.ts";
import type { Approval } from "./gate.ts";
import type { GuardSwitch } from "./guard.ts";
import type { IntentId, IntentSlug, RecordVersion, SpaceName, UnitName } from "./identities.ts";
import type { ReviewReceipt } from "./review.ts";
import type { BlockingCheck, Checkpoint, UnitDag } from "./unit.ts";

export type StageProgress =
  | "pending"
  | "in-progress"
  | "awaiting-approval"
  | "revising"
  | "completed"
  | "skipped";

export type StageState = {
  readonly stage: StageSlug;
  readonly unit: UnitName | null;
  readonly progress: StageProgress;
};

export type WorkflowStatus =
  | { readonly kind: "running" }
  | { readonly kind: "parked"; readonly since: Timestamp }
  | { readonly kind: "completed"; readonly at: Timestamp }
  | { readonly kind: "archived"; readonly at: Timestamp };

export type WorkflowSettings = {
  readonly depth: Depth;
  readonly guardPolicy: GuardPolicy;
  readonly ceremony: Readonly<Record<CeremonyKey, CeremonySwitch>>;
  readonly reviewOverride: ReviewClass | null;
};

export type WorkflowRecord = {
  readonly id: IntentId;
  readonly slug: IntentSlug;
  readonly space: SpaceName;
  readonly scope: ScopeName;
  readonly version: RecordVersion;
  readonly status: WorkflowStatus;
  readonly settings: WorkflowSettings;
  readonly stages: readonly StageState[];
  readonly units: UnitDag | null;
  readonly checkpoints: readonly Checkpoint[];
  readonly blockingChecks: readonly BlockingCheck[];
  readonly approvals: readonly Approval[];
  readonly reviews: readonly ReviewReceipt[];
  readonly guardSwitches: readonly GuardSwitch[];
};
