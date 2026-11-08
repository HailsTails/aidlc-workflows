import type { ProjectPath } from "../../kernel/values.ts";
import type { HookPoint } from "../../workflow-definition/domain/hooks.ts";
import type { ArtifactName } from "../../workflow-definition/domain/identities.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import type { ReviewPolicy, Stage } from "../../workflow-definition/domain/stage.ts";
import type { AuditEvent } from "./audit.ts";
import { turnEnding } from "./autonomy.ts";
import { CORE_GUARDS, type GuardRefusal } from "./guard.ts";
import { placeOf, type GuardRule } from "./guard-rules.ts";
import type { HostEventAt, VerdictFor } from "./host-event.ts";
import type { UnitName } from "./identities.ts";
import { artifactFreeze, reviewBudget, stageReviewClass } from "./review-attempt.ts";
import { nextRoute, type RouteContext, type RouteStep } from "./routing.ts";
import type { StageState, WorkflowRecord } from "./workflow-record.ts";

export type GuardedPoint = {
  [Point in HookPoint]: Extract<VerdictFor<Point>, { readonly kind: "block" }> extends never
    ? never
    : Point;
}[HookPoint];

export type ArtifactPlacement = (request: {
  readonly record: WorkflowRecord;
  readonly unit: UnitName | null;
  readonly artifact: ArtifactName;
}) => ProjectPath;

export type HostSituation<Point extends GuardedPoint> = {
  readonly point: Point;
  readonly event: HostEventAt<Point>;
  readonly record: WorkflowRecord;
  readonly method: Method;
  readonly events: readonly AuditEvent[];
  readonly placement: ArtifactPlacement;
  readonly routing: RouteContext;
};

export type HostGuardRule<Point extends GuardedPoint> = GuardRule<HostSituation<Point>>;

export type HostGuardRules = {
  readonly [Point in GuardedPoint]: readonly HostGuardRule<Point>[];
};

type FrozenWrite = {
  readonly path: ProjectPath;
  readonly stop: GuardRefusal;
};

type Reviewed = {
  readonly state: StageState;
  readonly stage: Stage;
  readonly review: ReviewPolicy;
};

const frozenReview = (situation: HostSituation<"before-tool">, reviewed: Reviewed): readonly FrozenWrite[] => {
  const { record, method, placement } = situation;
  const { state, stage, review } = reviewed;
  const at = { stage: state.stage, unit: state.unit };
  const budget = reviewBudget(stageReviewClass(record, { method, stage }), review);
  const freeze = artifactFreeze(record, { at, budget });
  return freeze.kind === "frozen"
    ? [
        {
          path: placement({ record, unit: state.unit, artifact: review.artifact }),
          stop: {
            guard: CORE_GUARDS.reviewFreeze,
            reason:
              `${freeze.receipt.attempt.artifact} for ${placeOf(at)} was reviewed ` +
              `(${freeze.receipt.verdict}) and stays as reviewed until the person asks for changes.`,
            nextStep: "Put the review to the person at the gate; record their Request Changes first.",
          },
        },
      ]
    : [];
};

const frozenWrites = (situation: HostSituation<"before-tool">, state: StageState): readonly FrozenWrite[] => {
  const stage = situation.method.stages.find((candidate) => candidate.slug === state.stage);
  const review = stage?.review ?? null;
  return stage === undefined || review === null ? [] : frozenReview(situation, { state, stage, review });
};

export const reviewFreezeRule: HostGuardRule<"before-tool"> = {
  declaration: CORE_GUARDS.reviewFreeze,
  check: (situation) =>
    situation.event.tool.classified === "file-write"
      ? (situation.record.stages
          .flatMap((state) => frozenWrites(situation, state))
          .find((frozen) => frozen.path === situation.event.tool.subject)?.stop ?? null)
      : null,
};

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

export const forwardingLoopRule: HostGuardRule<"stop"> = {
  declaration: CORE_GUARDS.forwardingLoop,
  check: (situation) => {
    const pending = pendingWork(nextRoute(situation.record, situation.routing));
    return pending === null ||
      turnEnding(situation.record.settings) === "may-end-turn" ||
      forwardingSinceProgress(situation.events) >= FORWARDING_LIMIT
      ? null
      : {
          guard: CORE_GUARDS.forwardingLoop,
          reason: `AI-DLC is carrying on with ${pending}.`,
          nextStep: "Ask the engine for the next step and carry that out before ending the turn.",
        };
  },
};

export const NO_HOST_RULES: HostGuardRules = {
  "user-prompt": [],
  "before-tool": [],
  "subagent-stop": [],
  stop: [],
};

export const CORE_HOST_RULES: HostGuardRules = {
  ...NO_HOST_RULES,
  "before-tool": [reviewFreezeRule],
  stop: [forwardingLoopRule],
};
