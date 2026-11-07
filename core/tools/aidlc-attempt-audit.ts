import { attemptFloor, isolatedAttemptState, latestIsolatedStart } from "./aidlc-attempt-boundary.ts";
import type { AttemptAction, AttemptFloor, AttemptObservation, AttemptScope, AttemptWorkflow } from "./aidlc-attempt-boundary.ts";
import { auditBlockField } from "./aidlc-markdown.ts";
import type { AuditShardEvent } from "./aidlc-record-core.ts";

export type PipelineAttemptFloor = AttemptFloor<AuditShardEvent>;
export interface AuditAttemptRequest {
  readonly scope: AttemptScope;
  readonly jumpTarget: (block: string, stage: string) => "reaches" | "misses";
}

function auditWorkflow(block: string): AttemptWorkflow {
  const workflow = auditBlockField(block, "Workflow");
  return workflow?.startsWith("single-stage:") ? { mode: "isolated", stage: workflow.slice("single-stage:".length) } : { mode: "pipeline" };
}

function auditAttemptAction(entry: AuditShardEvent, request: AuditAttemptRequest): AttemptAction {
  if (entry.event === "WORKFLOW_STARTED") return "workflow-start";
  if (entry.event === "STAGE_STARTED") return "stage-start";
  if (entry.event === "STAGE_COMPLETED") return "stage-complete";
  if (entry.event === "GATE_REJECTED") return "rejection";
  // Pipeline jumps are consulted in row order, even when their workflow will be excluded.
  if (request.scope.mode === "pipeline" && entry.event === "STAGE_JUMPED" && request.jumpTarget(entry.block, request.scope.stage) === "reaches") return "jump-reaches";
  return "unrelated";
}

export function auditAttemptObservations(events: readonly AuditShardEvent[], request: AuditAttemptRequest): AttemptObservation<AuditShardEvent>[] {
  return events.map((entry) => {
    const workflow = auditWorkflow(entry.block);
    const action = auditAttemptAction(entry, request);
    return { source: entry, workflow, action, stage: auditBlockField(entry.block, "Stage") };
  });
}

function isolatedAuditRequest(stage: string): AuditAttemptRequest {
  return { scope: { stage, mode: "isolated", rejection: "reset" }, jumpTarget: () => "misses" };
}

export function auditAttemptFloor(events: readonly AuditShardEvent[], request: AuditAttemptRequest): PipelineAttemptFloor | null {
  return attemptFloor(auditAttemptObservations(events, request), request.scope);
}

export function auditIsolatedAttemptState(events: readonly AuditShardEvent[], stage: string) {
  return isolatedAttemptState(auditAttemptObservations(events, isolatedAuditRequest(stage)), stage);
}

export function auditIsolatedAttemptField(events: readonly AuditShardEvent[], request: { readonly stage: string; readonly field: string }): string | null {
  const start = latestIsolatedStart(auditAttemptObservations(events, isolatedAuditRequest(request.stage)), request.stage);
  return start === null ? null : auditBlockField(start.block, request.field);
}
