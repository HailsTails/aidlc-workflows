import type { Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import type {
  AgentSlug,
  ArtifactName,
  RuleId,
} from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { Stage } from "../../workflow-definition/domain/stage.ts";
import { gateDecider } from "./autonomy.ts";
import type { Gate } from "./gate.ts";
import type { UnitName } from "./identities.ts";
import type { ReviewAttempt } from "./review.ts";
import { nextReviewStep, stageReviewClass, type ReviewStep } from "./review-attempt.ts";
import { moveStage } from "./stage-progress.ts";
import type { TransitionCause } from "./transition.ts";
import {
  completeWorkflow,
  progressFinished,
  type RecordChange,
  type RecordMoveRefusal,
  type StageState,
  type WorkflowRecord,
} from "./workflow-record.ts";

export type StageWork = {
  readonly stage: Stage;
  readonly unit: UnitName | null;
  readonly lead: AgentSlug | null;
  readonly supports: readonly AgentSlug[];
  readonly artifacts: readonly ArtifactName[];
  readonly rules: readonly RuleId[];
};

export type RouteStep =
  | { readonly kind: "moved"; readonly change: RecordChange }
  | { readonly kind: "run-stage"; readonly work: StageWork }
  | { readonly kind: "request-review"; readonly attempt: ReviewAttempt }
  | { readonly kind: "ask-person"; readonly gate: Gate; readonly stage: Stage }
  | { readonly kind: "finished" }
  | { readonly kind: "stopped"; readonly refusal: RecordMoveRefusal };

export type SpentBudget = {
  readonly record: WorkflowRecord;
  readonly state: StageState;
  readonly stage: Stage;
  readonly budget: number;
  readonly time: Timestamp;
  readonly atGate: RouteStep;
};

export type BudgetSpentPolicy = (spent: SpentBudget) => RouteStep;

export const UPSTREAM_BUDGET_SPENT: BudgetSpentPolicy = (spent) => spent.atGate;

export type RouteContext = {
  readonly method: Method;
  readonly personAsked: "asked" | "not-asked";
  readonly time: Timestamp;
  readonly budgetSpent: BudgetSpentPolicy;
};

type Placed = {
  readonly record: WorkflowRecord;
  readonly state: StageState;
  readonly stage: Stage;
  readonly context: RouteContext;
};

const ENGINE: TransitionCause = { kind: "engine-step" };

const moved = (movement: Result<RecordChange, RecordMoveRefusal>): RouteStep =>
  movement.ok
    ? { kind: "moved", change: movement.value }
    : { kind: "stopped", refusal: movement.refusal };

const workOf = (placed: Placed): StageWork => {
  const { stage, state, context } = placed;
  const { lead } = stage.participation;
  return {
    stage,
    unit: state.unit,
    lead: lead.kind === "agent" ? lead.agent : null,
    supports: stage.participation.supports,
    artifacts: stage.produces.map((production) => production.artifact),
    rules: context.method.graph.nodes.find((node) => node.stage === stage.slug)?.rulesInContext ?? [],
  };
};

const engineMove = (placed: Placed, move: "start" | "approve"): RouteStep =>
  moved(
    moveStage(placed.record, {
      at: { stage: placed.state.stage, unit: placed.state.unit },
      move,
      cause: ENGINE,
      time: placed.context.time,
    }),
  );

const atGate = (placed: Placed): RouteStep => {
  const gate: Gate = { kind: "stage", stage: placed.state.stage, unit: placed.state.unit };
  const decider = gateDecider({ gate, phase: placed.stage.phase, settings: placed.record.settings });
  return decider === "engine-may-decide"
    ? engineMove(placed, "approve")
    : { kind: "ask-person", gate, stage: placed.stage };
};

const budgetSpent = (placed: Placed, budget: number): RouteStep =>
  placed.context.budgetSpent({
    record: placed.record,
    state: placed.state,
    stage: placed.stage,
    budget,
    time: placed.context.time,
    atGate: atGate(placed),
  });

const afterReview = (placed: Placed, step: ReviewStep): RouteStep => {
  switch (step.kind) {
    case "request":
      return { kind: "request-review", attempt: step.attempt };
    case "budget-spent":
      return budgetSpent(placed, step.budget);
    case "finished":
    case "no-review":
      return atGate(placed);
  }
};

const awaitingApproval = (placed: Placed): RouteStep => {
  const step = nextReviewStep(placed.record, {
    at: { stage: placed.state.stage, unit: placed.state.unit },
    policy: placed.stage.review,
    reviewClass: stageReviewClass(placed.record, {
      method: placed.context.method,
      stage: placed.stage,
    }),
    personAsked: placed.context.personAsked,
    time: placed.context.time,
  });
  return afterReview(placed, step);
};

const routePlaced = (placed: Placed): RouteStep => {
  switch (placed.state.progress) {
    case "pending":
      return engineMove(placed, "start");
    case "in-progress":
    case "revising":
      return { kind: "run-stage", work: workOf(placed) };
    case "awaiting-approval":
      return awaitingApproval(placed);
    case "completed":
    case "skipped":
      return { kind: "finished" };
  }
};

const routeRunning = (record: WorkflowRecord, context: RouteContext): RouteStep => {
  const state = record.stages.find((candidate) => progressFinished(candidate.progress) === "unfinished");
  if (state === undefined) {
    return moved(completeWorkflow(record, context.time));
  }
  const stage = context.method.stages.find((candidate) => candidate.slug === state.stage);
  return stage === undefined
    ? { kind: "stopped", refusal: { kind: "stage-not-in-plan", stage: state.stage, unit: state.unit } }
    : routePlaced({ record, state, stage, context });
};

export const nextRoute = (record: WorkflowRecord, context: RouteContext): RouteStep => {
  switch (record.status.kind) {
    case "running":
      return routeRunning(record, context);
    case "parked":
      return {
        kind: "stopped",
        refusal: { kind: "workflow-status", status: record.status, needed: "running" },
      };
    case "completed":
    case "archived":
      return { kind: "finished" };
  }
};
