import type { Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { AuditEvent } from "../domain/audit.ts";
import type { HumanEvidence } from "../domain/gate.ts";
import type { IntentId, RecordVersion, SessionId, UnitName } from "../domain/identities.ts";
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
  append(event: AuditEvent): Promise<void>;
  since(request: {
    readonly intent: IntentId;
    readonly from: Timestamp;
  }): Promise<readonly AuditEvent[]>;
}

export interface Clock {
  now(): Timestamp;
}

export interface HostEvents {
  humanTurnsSince(request: {
    readonly session: SessionId;
    readonly from: Timestamp;
  }): Promise<readonly HumanEvidence[]>;
}

export interface Sessions {
  current(): Promise<Session | null>;
}

export interface UnitClaims {
  holders(intent: IntentId): Promise<readonly UnitHolder[]>;
  claim(request: {
    readonly intent: IntentId;
    readonly unit: UnitName;
  }): Promise<Result<UnitHolder, ExecutionRefusal>>;
}

export interface MethodProvider {
  current(): Promise<Result<Method, ExecutionRefusal>>;
}

export type HostConversation = {
  readonly missedReply: string | null;
  readonly agentStep: string | null;
  readonly newChatStep: string | null;
  readonly directiveMaxBytes: number;
  readonly questionOptions: number;
};

export interface HostConversationSource {
  conversation(): HostConversation;
}
