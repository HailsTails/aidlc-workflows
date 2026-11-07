// Attempt policy consumes observations, not the representation of the audit record.
export interface AttemptPosition {
  readonly timestamp: string;
  readonly shard: string;
  readonly shardIndex: number;
  readonly pos: number;
}

export type AttemptWorkflow = { readonly mode: "pipeline" } | { readonly mode: "isolated"; readonly stage: string };
export type AttemptAction = "workflow-start" | "stage-start" | "stage-complete" | "rejection" | "jump-reaches" | "unrelated";
export interface AttemptObservation<Row extends AttemptPosition> {
  readonly source: Row;
  readonly action: AttemptAction;
  readonly stage: string | null;
  readonly workflow: AttemptWorkflow;
}

export interface AttemptScope {
  readonly stage: string;
  readonly mode: "pipeline" | "isolated";
  readonly rejection: "reset" | "retain";
}

export interface AttemptFloor<Row extends AttemptPosition> {
  readonly timestamp: string;
  readonly rows: readonly Row[];
}

type FloorOrder = { readonly kind: "ambiguous" } | { readonly kind: "ordered"; readonly shard: string; readonly position: number };
export type AttemptState = "not-started" | "ambiguous" | "completed" | "open";

function workflowParticipation(workflow: AttemptWorkflow, scope: AttemptScope): "included" | "excluded" {
  if (scope.mode === "pipeline") return workflow.mode === "pipeline" ? "included" : "excluded";
  return workflow.mode === "isolated" && workflow.stage === scope.stage ? "included" : "excluded";
}

function boundaryRole<Row extends AttemptPosition>(observation: AttemptObservation<Row>, scope: AttemptScope): "boundary" | "evidence" {
  if (workflowParticipation(observation.workflow, scope) === "excluded") return "evidence";
  if (observation.action === "stage-start" && observation.stage === scope.stage) return "boundary";
  if (scope.mode === "isolated") return "evidence";
  if (observation.action === "workflow-start" || observation.action === "jump-reaches") return "boundary";
  return observation.action === "rejection" && scope.rejection === "reset" && observation.stage === scope.stage ? "boundary" : "evidence";
}

export function attemptFloor<Row extends AttemptPosition>(observations: readonly AttemptObservation<Row>[], scope: AttemptScope): AttemptFloor<Row> | null {
  const boundaries = observations.filter((observation) => boundaryRole(observation, scope) === "boundary");
  const last = boundaries.at(-1);
  if (last === undefined) return null;
  // The supplied order is authoritative: do not replace its last boundary with a timestamp maximum.
  const timestamp = last.source.timestamp;
  return { timestamp, rows: boundaries.filter((observation) => observation.source.timestamp === timestamp).map((observation) => observation.source) };
}

function floorOrder<Row extends AttemptPosition>(floor: AttemptFloor<Row>): FloorOrder {
  const shards = new Set(floor.rows.map((row) => row.shard));
  const first = floor.rows[0];
  if (shards.size !== 1 || first === undefined) return { kind: "ambiguous" };
  return { kind: "ordered", shard: first.shard, position: Math.max(...floor.rows.map((row) => row.pos)) };
}

export function attemptEventPosition<Row extends AttemptPosition>(entry: Row, floor: AttemptFloor<Row> | null): "after" | "not-after" {
  if (floor === null) return "after";
  // Audit timestamps have always used string ordering, including non-ISO values.
  if (entry.timestamp !== floor.timestamp) return entry.timestamp > floor.timestamp ? "after" : "not-after";
  const order = floorOrder(floor);
  return order.kind === "ordered" && entry.shard === order.shard && entry.pos > order.position ? "after" : "not-after";
}

function completionPosition<Row extends AttemptPosition>(entry: Row, floor: AttemptFloor<Row>): "later" | "ambiguous" | "earlier" {
  if (attemptEventPosition(entry, floor) === "after") return "later";
  const order = floorOrder(floor);
  return entry.timestamp === floor.timestamp && order.kind === "ordered" && entry.shard !== order.shard ? "ambiguous" : "earlier";
}

export function isolatedAttemptState<Row extends AttemptPosition>(observations: readonly AttemptObservation<Row>[], stage: string): AttemptState {
  const scope: AttemptScope = { stage, mode: "isolated", rejection: "reset" };
  const floor = attemptFloor(observations, scope);
  if (floor === null) return "not-started";
  if (floorOrder(floor).kind === "ambiguous") return "ambiguous";
  const completions = observations.filter((observation) => observation.action === "stage-complete" && observation.stage === stage && workflowParticipation(observation.workflow, scope) === "included");
  const closing = completions.map((observation) => completionPosition(observation.source, floor));
  if (closing.includes("later")) return "completed";
  return closing.includes("ambiguous") ? "ambiguous" : "open";
}

function compareAttemptPositions(left: AttemptPosition, right: AttemptPosition): number {
  if (left.timestamp !== right.timestamp) return left.timestamp < right.timestamp ? -1 : 1;
  if (left.shardIndex !== right.shardIndex) return left.shardIndex - right.shardIndex;
  return left.pos - right.pos;
}

export function latestIsolatedStart<Row extends AttemptPosition>(observations: readonly AttemptObservation<Row>[], stage: string): Row | null {
  const scope: AttemptScope = { stage, mode: "isolated", rejection: "reset" };
  const starts = observations.filter((observation) => observation.action === "stage-start" && observation.stage === stage && workflowParticipation(observation.workflow, scope) === "included");
  // Stable sorting retains the last supplied row when every ordering key ties.
  return starts.map((observation) => observation.source).sort(compareAttemptPositions).at(-1) ?? null;
}
