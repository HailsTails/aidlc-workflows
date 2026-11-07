// Pure attempt boundaries over captured, ordered audit rows. No record selection or policy decision.
import type { AuditShardEvent } from "./aidlc-record-core.ts";
import { auditBlockField } from "./aidlc-markdown.ts";
type OrderedPipelineEvidenceEvent = AuditShardEvent;

export interface PipelineAttemptFloor {
  timestamp: string;
  rows: OrderedPipelineEvidenceEvent[];
}

export function pipelineAttemptFloorIn(
  events: OrderedPipelineEvidenceEvent[],
  stageSlug: string,
  singleRun: boolean,
  rejectionKeepsReceipts: boolean,
  stageJumpReaches: (block: string, slug: string) => boolean,
): PipelineAttemptFloor | null {
  const workflow = `single-stage:${stageSlug}`;
  const boundaries = events.filter((entry) => {
    const eventWorkflow = auditBlockField(entry.block, "Workflow");
    if (
      !singleRun &&
      (
        entry.event === "WORKFLOW_STARTED" ||
        (entry.event === "STAGE_JUMPED" && stageJumpReaches(entry.block, stageSlug)) ||
        (
          entry.event === "GATE_REJECTED" &&
          !rejectionKeepsReceipts &&
          auditBlockField(entry.block, "Stage") === stageSlug
        )
      ) &&
      !eventWorkflow?.startsWith("single-stage:")
    ) {
      return true;
    }
    return (
      entry.event === "STAGE_STARTED" &&
      auditBlockField(entry.block, "Stage") === stageSlug &&
      (
        singleRun
          ? eventWorkflow === workflow
          : !eventWorkflow?.startsWith("single-stage:")
      )
    );
  });
  if (boundaries.length === 0) return null;
  const timestamp = boundaries[boundaries.length - 1].timestamp;
  return {
    timestamp,
    rows: boundaries.filter((entry) => entry.timestamp === timestamp),
  };
}

export function pipelineEventAfterFloor(
  entry: OrderedPipelineEvidenceEvent,
  floor: PipelineAttemptFloor | null,
): boolean {
  if (floor === null) return true;
  if (entry.timestamp !== floor.timestamp) {
    return entry.timestamp > floor.timestamp;
  }
  const shards = new Set(floor.rows.map((row) => row.shard));
  if (shards.size !== 1) return false;
  const shard = floor.rows[0].shard;
  if (entry.shard !== shard) return false;
  const maxPos = Math.max(...floor.rows.map((row) => row.pos));
  return entry.pos > maxPos;
}

export function singleStageAttemptOpenIn(
  events: OrderedPipelineEvidenceEvent[],
  stageSlug: string,
): boolean {
  const workflow = `single-stage:${stageSlug}`;
  const floor = pipelineAttemptFloorIn(events, stageSlug, true, false, () => false);
  if (floor === null) return false;
  const floorShards = new Set(floor.rows.map((row) => row.shard));
  if (floorShards.size !== 1) return false;
  const floorShard = floor.rows[0].shard;
  const floorPos = Math.max(...floor.rows.map((row) => row.pos));
  for (const entry of events) {
    if (
      entry.event !== "STAGE_COMPLETED" ||
      auditBlockField(entry.block, "Stage") !== stageSlug ||
      auditBlockField(entry.block, "Workflow") !== workflow
    ) {
      continue;
    }
    if (pipelineEventAfterFloor(entry, floor)) return false;
    if (
      entry.timestamp === floor.timestamp &&
      entry.shard !== floorShard
    ) {
      return false;
    }
    if (
      entry.timestamp === floor.timestamp &&
      entry.shard === floorShard &&
      entry.pos > floorPos
    ) {
      return false;
    }
  }
  return true;
}

export function singleStageAttemptFieldIn(events: readonly AuditShardEvent[], slug: string, field: string): string | null {
  const workflow = `single-stage:${slug}`;
  const attemptStart = events
    .filter((entry) =>
      entry.event === "STAGE_STARTED" &&
      auditBlockField(entry.block, "Stage") === slug &&
      auditBlockField(entry.block, "Workflow") === workflow
    )
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? -1 : 1;
      if (a.shardIndex !== b.shardIndex) return a.shardIndex - b.shardIndex;
      return a.pos - b.pos;
    })
    .pop();
  return attemptStart ? auditBlockField(attemptStart.block, field) : null;
}

