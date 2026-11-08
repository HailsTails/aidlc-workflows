import { accepted, refused, type Refused, type Result } from "../../kernel/result.ts";
import type { NonEmptyArray, Timestamp } from "../../kernel/values.ts";
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
import type { Transition } from "./transition.ts";
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

export type StageAt = {
  readonly stage: StageSlug;
  readonly unit: UnitName | null;
};

export type RecordChange = {
  readonly record: WorkflowRecord;
  readonly transitions: readonly Transition[];
};

export type WorkflowStatusKind = WorkflowStatus["kind"];

export type RecordMoveRefusal =
  | {
      readonly kind: "workflow-status";
      readonly status: WorkflowStatus;
      readonly needed: WorkflowStatusKind;
    }
  | { readonly kind: "stage-not-in-plan"; readonly stage: StageSlug; readonly unit: UnitName | null }
  | {
      readonly kind: "stage-out-of-order";
      readonly at: StageState;
      readonly allowedFrom: NonEmptyArray<StageProgress>;
    }
  | { readonly kind: "stages-unfinished"; readonly remaining: NonEmptyArray<StageState> };

const FINISHED_PROGRESS: readonly StageProgress[] = ["completed", "skipped"];

export const progressFinished = (progress: StageProgress): "finished" | "unfinished" =>
  FINISHED_PROGRESS.includes(progress) ? "finished" : "unfinished";

const statusRefusal = (
  status: WorkflowStatus,
  needed: WorkflowStatusKind,
): Refused<RecordMoveRefusal> => refused({ kind: "workflow-status", status, needed });

const changed = (record: WorkflowRecord, transition: Transition): RecordChange => ({
  record,
  transitions: [transition],
});

export const parkWorkflow = (
  record: WorkflowRecord,
  time: Timestamp,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running"
    ? accepted(
        changed({ ...record, status: { kind: "parked", since: time } }, { kind: "park", at: time }),
      )
    : statusRefusal(record.status, "running");

export const resumeWorkflow = (
  record: WorkflowRecord,
  time: Timestamp,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "parked"
    ? accepted(changed({ ...record, status: { kind: "running" } }, { kind: "resume", at: time }))
    : statusRefusal(record.status, "parked");

export type ReopenRequest = {
  readonly time: Timestamp;
  readonly personSinceFinished: "spoke" | "silent";
};

export const reopenWorkflow = (
  record: WorkflowRecord,
  request: ReopenRequest,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "completed"
    ? accepted(
        changed(
          { ...record, status: { kind: "running" } },
          { kind: "reopen", personSinceFinished: request.personSinceFinished, at: request.time },
        ),
      )
    : statusRefusal(record.status, "completed");

const unfinishedStages = (record: WorkflowRecord): readonly StageState[] =>
  record.stages.filter((state) => progressFinished(state.progress) === "unfinished");

const completeRunning = (
  record: WorkflowRecord,
  time: Timestamp,
): Result<RecordChange, RecordMoveRefusal> => {
  const [first, ...rest] = unfinishedStages(record);
  return first === undefined
    ? accepted(
        changed({ ...record, status: { kind: "completed", at: time } }, { kind: "complete", at: time }),
      )
    : refused({ kind: "stages-unfinished", remaining: [first, ...rest] });
};

export const completeWorkflow = (
  record: WorkflowRecord,
  time: Timestamp,
): Result<RecordChange, RecordMoveRefusal> =>
  record.status.kind === "running"
    ? completeRunning(record, time)
    : statusRefusal(record.status, "running");
