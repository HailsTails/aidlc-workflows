import type { Result } from "../../kernel/result.ts";
import type { Directive } from "../domain/directive.ts";
import type { Gate, GateDecision } from "../domain/gate.ts";
import type { HookPoint } from "../../workflow-definition/domain/hooks.ts";
import type { HostEventAt, VerdictFor } from "../domain/host-event.ts";
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
  observe<Point extends HookPoint>(event: HostEventAt<Point>): Promise<VerdictFor<Point>>;
}

export interface ReopenWorkflow {
  reopen(request: {
    readonly intent: IntentId;
    readonly session: SessionId;
  }): Promise<Result<WorkflowRecord, ExecutionRefusal>>;
}
