import { accepted, type Result } from "../../kernel/result.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { transitionFacts } from "../domain/audit.ts";
import type { Directive } from "../domain/directive.ts";
import { STAGE_GATE_OPTIONS, stageGateQuestion } from "../domain/gate-question.ts";
import { transitionStop } from "../domain/guard-stops.ts";
import type { IntentId } from "../domain/identities.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import { nextRoute, type RouteStep, type StageWork } from "../domain/routing.ts";
import type { RecordChange, WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditTrail } from "./audit-trail.ts";
import type { MethodProvider } from "./boundary-ports.ts";
import type { ArtifactLocations, AuditLog, Clock, RecordStore } from "./ports.ts";
import type { NextStep } from "./use-cases.ts";

export type NextStepDependencies = {
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly methods: MethodProvider;
  readonly artifacts: ArtifactLocations;
};

type Stepping = NextStepDependencies & { readonly trail: AuditTrail };

type Routing = {
  readonly record: WorkflowRecord;
  readonly method: Method;
};

type Stepped = Result<Directive, ExecutionRefusal>;

const runStage = (stepping: Stepping, routing: Routing & { readonly work: StageWork }): Directive => {
  const { work, record } = routing;
  return {
    kind: "run-stage",
    stage: work.stage.slug,
    unit: work.unit,
    lead: work.lead,
    supports: work.supports,
    produces: work.artifacts.map((artifact) => ({
      artifact,
      path: stepping.artifacts.destinationOf({ record, unit: work.unit, artifact }),
    })),
    rules: work.rules,
  };
};

const directiveFor = async (
  stepping: Stepping,
  routing: Routing & { readonly step: Exclude<RouteStep, { readonly kind: "moved" }> },
): Promise<Directive> => {
  const { step } = routing;
  switch (step.kind) {
    case "run-stage":
      return runStage(stepping, { ...routing, work: step.work });
    case "request-review":
      await stepping.trail.record(
        { intent: routing.record.id, session: null, at: stepping.clock.now() },
        { kind: "review-requested", attempt: step.attempt },
      );
      return { kind: "request-review", attempt: step.attempt };
    case "ask-person":
      return {
        kind: "ask-person",
        gate: step.gate,
        question: stageGateQuestion(step.stage),
        options: STAGE_GATE_OPTIONS,
      };
    case "finished":
      return { kind: "finished" };
    case "stopped":
      return { kind: "refused", refusal: transitionStop(step.refusal) };
  }
};

const applyMove = async (
  stepping: Stepping,
  moving: Routing & { readonly change: RecordChange },
): Promise<Result<WorkflowRecord, ExecutionRefusal>> => {
  const saved = await stepping.records.save({
    record: moving.change.record,
    expected: moving.record.version,
  });
  if (saved.ok) {
    await stepping.trail.recordAll(
      { intent: moving.record.id, session: null, at: stepping.clock.now() },
      transitionFacts(moving.change.transitions),
    );
  }
  return saved;
};

const route = async (stepping: Stepping, routing: Routing): Promise<Stepped> => {
  const step = nextRoute(routing.record, {
    method: routing.method,
    personAsked: "not-asked",
    time: stepping.clock.now(),
  });
  if (step.kind !== "moved") {
    return accepted(await directiveFor(stepping, { ...routing, step }));
  }
  const saved = await applyMove(stepping, { ...routing, change: step.change });
  return saved.ok ? route(stepping, { ...routing, record: saved.value }) : saved;
};

const next = async (stepping: Stepping, request: { readonly intent: IntentId }): Promise<Stepped> => {
  const [loaded, method] = await Promise.all([
    stepping.records.load(request.intent),
    stepping.methods.current(),
  ]);
  if (!loaded.ok) {
    return loaded;
  }
  return method.ok
    ? route(stepping, { record: loaded.value, method: method.value })
    : method;
};

export const nextStepUseCase = (dependencies: NextStepDependencies): NextStep => {
  const stepping: Stepping = { ...dependencies, trail: auditTrail(dependencies.audit) };
  return { next: (request) => next(stepping, request) };
};
