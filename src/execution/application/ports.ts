import type { Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type { AuditEntry, AuditEvent } from "../domain/audit.ts";
import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type {
  AuditSequence,
  IntentId,
  PlanFingerprint,
  RecordVersion,
  UnitName,
} from "../domain/identities.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import type { Session } from "../domain/session.ts";
import type { UnitHolder } from "../domain/unit.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";

export interface RecordStore {
  load(intent: IntentId): Promise<Result<WorkflowRecord, ExecutionRefusal>>;
  save(request: {
    readonly record: WorkflowRecord;
    readonly expected: RecordVersion;
  }): Promise<Result<WorkflowRecord, ExecutionRefusal>>;
}

export interface AuditLog {
  append(entry: AuditEntry): Promise<AuditEvent>;
  since(request: {
    readonly intent: IntentId;
    readonly after: AuditSequence | null;
  }): Promise<readonly AuditEvent[]>;
}

export interface Clock {
  now(): Timestamp;
}

export interface Sessions {
  current(): Promise<Session | null>;
}

export interface PlanFingerprints {
  current(request: {
    readonly intent: IntentId;
    readonly stage: StageSlug;
    readonly unit: UnitName;
  }): Promise<PlanFingerprint | null>;
}

export interface UnitClaims {
  holders(intent: IntentId): Promise<readonly UnitHolder[]>;
  claim(request: {
    readonly intent: IntentId;
    readonly unit: UnitName;
  }): Promise<Result<UnitHolder, ExecutionRefusal>>;
}
