import type { Method } from "../../workflow-definition/domain/method.ts";
import type { AuditEvent } from "../domain/audit.ts";
import type { GuardRefusal } from "../domain/guard.ts";
import type { HostEvent, HostEventAt, ObservedHostEvent } from "../domain/host-event.ts";
import type { GuardedPoint, HostGuardRules, HostSituation } from "../domain/host-guard-rules.ts";
import type { IntentId } from "../domain/identities.ts";
import type { BudgetSpentPolicy } from "../domain/routing.ts";
import { progressFinished, type WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditTrail } from "./audit-trail.ts";
import type { MethodProvider } from "./boundary-ports.ts";
import type {
  ArtifactLocations,
  AuditLog,
  Clock,
  GuardEnvironment,
  RecordStore,
  Sessions,
} from "./ports.ts";
import { stopRaiser, type RaiseStop } from "./raise-stop.ts";
import type { ObserveHostEvent } from "./use-cases.ts";

export type ObserveHostEventDependencies = {
  readonly sessions: Sessions;
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly methods: MethodProvider;
  readonly artifacts: ArtifactLocations;
  readonly environment: GuardEnvironment;
  readonly rules: HostGuardRules;
  readonly budgetSpent: BudgetSpentPolicy;
};

type Observing = ObserveHostEventDependencies & {
  readonly trail: AuditTrail;
  readonly raise: RaiseStop;
};

type Bound = {
  readonly record: WorkflowRecord;
  readonly method: Method;
  readonly observed: AuditEvent;
};

type Allow = { readonly kind: "allow" };

type Guarded = Allow | { readonly kind: "block"; readonly refusal: GuardRefusal };

const ALLOW: Allow = { kind: "allow" };

const situationAt = async <Point extends GuardedPoint>(
  observing: Observing,
  watched: { readonly bound: Bound; readonly point: Point; readonly event: HostEventAt<Point> },
): Promise<HostSituation<Point>> => ({
  point: watched.point,
  event: watched.event,
  record: watched.bound.record,
  method: watched.bound.method,
  events: await observing.audit.since({ intent: watched.bound.record.id, after: null }),
  placement: (request) => observing.artifacts.destinationOf(request),
  routing: {
    method: watched.bound.method,
    personAsked: "not-asked",
    time: observing.clock.now(),
    budgetSpent: observing.budgetSpent,
  },
});

const firstHeld = (
  observing: Observing,
  stopping: { readonly bound: Bound; readonly refusals: readonly GuardRefusal[] },
): Promise<Guarded> =>
  stopping.refusals.reduce<Promise<Guarded>>(async (earlier, refusal) => {
    const guarded = await earlier;
    if (guarded.kind === "block") {
      return guarded;
    }
    const verdict = await observing.raise({
      refusal,
      record: stopping.bound.record,
      scene: { intent: stopping.bound.record.id, session: null, at: stopping.bound.observed.at },
      after: stopping.bound.observed,
    });
    return verdict.kind === "holds" ? { kind: "block", refusal: verdict.refusal } : ALLOW;
  }, Promise.resolve(ALLOW));

const guardedAt = async <Point extends GuardedPoint>(
  observing: Observing,
  watched: { readonly bound: Bound; readonly point: Point; readonly event: HostEventAt<Point> },
): Promise<Guarded> => {
  const rules = observing.rules[watched.point];
  if (rules.length === 0) {
    return ALLOW;
  }
  const situation = await situationAt(observing, watched);
  const refusals = rules.flatMap((rule) => rule.check(situation) ?? []);
  return firstHeld(observing, { bound: watched.bound, refusals });
};

const statusText = (record: WorkflowRecord): string => {
  const current = record.stages.find((state) => progressFinished(state.progress) === "unfinished");
  return current === undefined
    ? `AI-DLC · ${record.slug} · ${record.status.kind}`
    : `AI-DLC · ${record.slug} · ${current.stage} (${current.progress})`;
};

const observeBound = async (
  observing: Observing,
  watched: { readonly bound: Bound; readonly event: HostEvent },
): Promise<ObservedHostEvent> => {
  const { bound, event } = watched;
  switch (event.point) {
    case "before-tool":
      return { event, verdict: await guardedAt(observing, { bound, point: event.point, event }) };
    case "stop":
      return { event, verdict: await guardedAt(observing, { bound, point: event.point, event }) };
    case "user-prompt":
      return { event, verdict: await guardedAt(observing, { bound, point: event.point, event }) };
    case "subagent-stop":
      return { event, verdict: await guardedAt(observing, { bound, point: event.point, event }) };
    case "status-line":
      return { event, verdict: { kind: "show-status", text: statusText(bound.record) } };
    case "session-start":
      return { event, verdict: ALLOW };
    case "session-end":
      return { event, verdict: ALLOW };
    case "after-tool":
      return { event, verdict: ALLOW };
    case "subagent-start":
      return { event, verdict: ALLOW };
    case "before-compaction":
      return { event, verdict: ALLOW };
  }
};

const observeUnbound = (event: HostEvent): ObservedHostEvent => {
  switch (event.point) {
    case "status-line":
      return { event, verdict: { kind: "show-status", text: "AI-DLC" } };
    case "session-start":
      return { event, verdict: ALLOW };
    case "session-end":
      return { event, verdict: ALLOW };
    case "user-prompt":
      return { event, verdict: ALLOW };
    case "after-tool":
      return { event, verdict: ALLOW };
    case "subagent-start":
      return { event, verdict: ALLOW };
    case "subagent-stop":
      return { event, verdict: ALLOW };
    case "before-compaction":
      return { event, verdict: ALLOW };
    case "before-tool":
      return { event, verdict: ALLOW };
    case "stop":
      return { event, verdict: ALLOW };
  }
};

const bind = async (
  observing: Observing,
  binding: { readonly intent: IntentId; readonly observed: AuditEvent },
): Promise<Bound | null> => {
  const [record, method] = await Promise.all([
    observing.records.load(binding.intent),
    observing.methods.current(),
  ]);
  return record.ok && method.ok
    ? { record: record.value, method: method.value, observed: binding.observed }
    : null;
};

const observe = async (observing: Observing, event: HostEvent): Promise<ObservedHostEvent> => {
  const session = await observing.sessions.current();
  const intent = session?.binding?.intent ?? null;
  const observed = await observing.trail.record(
    { intent, session: event.session, at: event.at },
    { kind: "host-event", point: event.point },
  );
  const bound = intent === null ? null : await bind(observing, { intent, observed });
  return bound === null ? observeUnbound(event) : observeBound(observing, { bound, event });
};

export const observeHostEventUseCase = (
  dependencies: ObserveHostEventDependencies,
): ObserveHostEvent => {
  const observing: Observing = {
    ...dependencies,
    trail: auditTrail(dependencies.audit),
    raise: stopRaiser(dependencies),
  };
  return { observe: (event) => observe(observing, event) };
};
