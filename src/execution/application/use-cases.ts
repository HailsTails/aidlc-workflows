import type { Result } from "../../kernel/result.ts";
import type { Directive } from "../domain/directive.ts";
import type { Gate, GateDecision } from "../domain/gate.ts";
import type { HostEvent, HostEventVerdict } from "../domain/host-event.ts";
import type { IntentId, SessionId } from "../domain/identities.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";

export interface NextStep {
  next(request: { readonly intent: IntentId }): Promise<Result<Directive, ExecutionRefusal>>;
}

export interface DecideAtGate {
  decide(request: {
    readonly intent: IntentId;
    readonly gate: Gate;
    readonly decision: GateDecision;
    readonly session: SessionId;
  }): Promise<Result<WorkflowRecord, ExecutionRefusal>>;
}

export interface ObserveHostEvent {
  observe(event: HostEvent): Promise<HostEventVerdict>;
}

export interface ReopenWorkflow {
  reopen(request: {
    readonly intent: IntentId;
    readonly session: SessionId;
  }): Promise<Result<WorkflowRecord, ExecutionRefusal>>;
}
