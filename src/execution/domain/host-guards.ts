import type { ProjectPath } from "../../kernel/values.ts";
import type { ArtifactName } from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { ReviewPolicy, Stage } from "../../workflow-definition/domain/stage.ts";
import type { AuditEvent } from "./audit.ts";
import { CORE_GUARDS, type GuardRefusal } from "./guard.ts";
import { reviewFreezeStop } from "./guard-stops.ts";
import type { UnitName } from "./identities.ts";
import type { RouteStep } from "./routing.ts";
import { artifactFreeze, reviewBudget, stageReviewClass } from "./review-attempt.ts";
import type { StageState, WorkflowRecord } from "./workflow-record.ts";

export type ArtifactPlacement = (request: {
  readonly record: WorkflowRecord;
  readonly unit: UnitName | null;
  readonly artifact: ArtifactName;
}) => ProjectPath;

export type WriteWatch = {
  readonly record: WorkflowRecord;
  readonly method: Method;
  readonly placement: ArtifactPlacement;
};

type FrozenWrite = {
  readonly path: ProjectPath;
  readonly stop: GuardRefusal;
};

const frozenReview = (
  watch: WriteWatch,
  reviewed: { readonly state: StageState; readonly stage: Stage; readonly review: ReviewPolicy },
): readonly FrozenWrite[] => {
  const { state, stage, review } = reviewed;
  const at = { stage: state.stage, unit: state.unit };
  const reviewClass = stageReviewClass(watch.record, { method: watch.method, stage });
  const freeze = artifactFreeze(watch.record, {
    at,
    artifact: review.artifact,
    budget: reviewBudget(reviewClass, review),
  });
  return freeze.kind === "frozen"
    ? [
        {
          path: watch.placement({ record: watch.record, unit: state.unit, artifact: review.artifact }),
          stop: reviewFreezeStop({ at, receipt: freeze.receipt }),
        },
      ]
    : [];
};

const frozenWrites = (watch: WriteWatch, state: StageState): readonly FrozenWrite[] => {
  const stage = watch.method.stages.find((candidate) => candidate.slug === state.stage);
  const review = stage?.review ?? null;
  return stage === undefined || review === null ? [] : frozenReview(watch, { state, stage, review });
};

export const writeStop = (watch: WriteWatch, subject: string | null): GuardRefusal | null =>
  watch.record.stages
    .flatMap((state) => frozenWrites(watch, state))
    .find((frozen) => frozen.path === subject)?.stop ?? null;

export const FORWARDING_LIMIT = 8;

const isForwardingStop = (event: AuditEvent): "forwarding" | "other" =>
  event.fact.kind === "guard-refused" && event.fact.refusal.guard.id === CORE_GUARDS.forwardingLoop.id
    ? "forwarding"
    : "other";

export const forwardingSinceProgress = (events: readonly AuditEvent[]): number => {
  const sinceProgress = events.reduce<readonly AuditEvent[]>(
    (trailing, event) => (event.fact.kind === "transition" ? [] : [...trailing, event]),
    [],
  );
  return sinceProgress.filter((event) => isForwardingStop(event) === "forwarding").length;
};

export type StopWatch = {
  readonly record: WorkflowRecord;
  readonly route: RouteStep;
  readonly events: readonly AuditEvent[];
};

const pendingWork = (route: RouteStep): string | null => {
  switch (route.kind) {
    case "run-stage":
      return `running ${route.work.stage.displayName}`;
    case "request-review":
      return `the review of ${route.attempt.artifact}`;
    case "moved":
    case "ask-person":
    case "finished":
    case "stopped":
      return null;
  }
};

export const forwardingStop = (watch: StopWatch): GuardRefusal | null => {
  const pending = pendingWork(watch.route);
  return pending === null ||
    watch.record.settings.constructionAutonomy === "gated" ||
    forwardingSinceProgress(watch.events) >= FORWARDING_LIMIT
    ? null
    : {
        guard: CORE_GUARDS.forwardingLoop,
        reason: `AI-DLC is carrying on with ${pending}.`,
        nextStep: "Ask the engine for the next step and carry that out before ending the turn.",
      };
};
