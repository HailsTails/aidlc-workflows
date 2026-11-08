import type { Timestamp } from "../../kernel/values.ts";
import type { SensorId, StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { UnitKind } from "../../workflow-definition/domain/vocabulary.ts";
import type { CheckoutId, PlanFingerprint, UnitName } from "./identities.ts";

export type Unit = {
  readonly name: UnitName;
  readonly kind: UnitKind | null;
  readonly dependsOn: readonly UnitName[];
};

export type UnitDag = {
  readonly units: readonly Unit[];
  readonly batches: readonly (readonly UnitName[])[];
};

export type UnitHolder = {
  readonly unit: UnitName;
  readonly checkout: CheckoutId;
  readonly owner: string;
  readonly generation: number;
  readonly claimedAt: Timestamp;
};

export type CheckpointKind = "unit" | "skeleton";

export type Checkpoint = {
  readonly kind: CheckpointKind;
  readonly unit: UnitName;
  readonly stages: readonly StageSlug[];
  readonly fingerprint: PlanFingerprint;
  readonly verification: "verified" | "unverified";
  readonly approval: "approved" | "awaiting-approval";
};

export type BlockingCheckSite =
  | { readonly kind: "gate"; readonly stage: StageSlug }
  | { readonly kind: "checkpoint"; readonly unit: UnitName; readonly checkpoint: CheckpointKind };

export type BlockingCheckOutcome = "passed" | "failed" | "overridden";

export type BlockingCheck = {
  readonly sensor: SensorId;
  readonly site: BlockingCheckSite;
  readonly outcome: BlockingCheckOutcome;
  readonly checkedAt: Timestamp;
};
