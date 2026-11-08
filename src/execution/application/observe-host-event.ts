import type { Method } from "../../workflow-definition/domain/method.ts";
import type { AuditEvent, AuditFact } from "../domain/audit.ts";
import type { GuardRefusal } from "../domain/guard.ts";
import { enforce, type GuardContext, type GuardVerdict } from "../domain/guard-standing.ts";
import type { HostEvent, HostEventAt, ObservedHostEvent } from "../domain/host-event.ts";
import { forwardingStop, writeStop } from "../domain/host-guards.ts";
import type { IntentId } from "../domain/identities.ts";
import { nextRoute } from "../domain/routing.ts";
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
import type { ObserveHostEvent } from "./use-cases.ts";

export type ObserveHostEventDependencies = {
  readonly sessions: Sessions;
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly methods: MethodProvider;
  readonly artifacts: ArtifactLocations;
  readonly guards: GuardEnvironment;
};

type Observing = ObserveHostEventDependencies & { readonly trail: AuditTrail };

type Bound = {
  readonly record: WorkflowRecord;
  readonly method: Method;
  readonly observed: AuditEvent;
};

type Allow = { readonly kind: "allow" };

type Guarded = Allow | { readonly kind: "block"; readonly refusal: GuardRefusal };

const ALLOW: Allow = { kind: "allow" };

const guardContext = async (observing: Observing, record: WorkflowRecord): Promise<GuardContext> => ({
  policy: record.settings.guardPolicy,
  lock: await observing.guards.lock(),
  switches: record.guardSwitches,
  machineLowered: await observing.guards.machineLowered(),
});

const verdictFact = (verdict: GuardVerdict): AuditFact =>
  verdict.kind === "holds"
    ? { kind: "guard-refused", refusal: verdict.refusal }
    : { kind: "guard-stood-aside", guard: verdict.guard, because: verdict.because };

const guarded = async (
  observing: Observing,
  stopping: { readonly bound: Bound; readonly refusal: GuardRefusal | null },
): Promise<Guarded> => {
  const { bound, refusal } = stopping;
  if (refusal === null) {
    return ALLOW;
  }
  const verdict = enforce(refusal, await guardContext(observing, bound.record));
  await observing.trail.recordAfter(bound.observed, [verdictFact(verdict)]);
  return verdict.kind === "holds" ? { kind: "block", refusal: verdict.refusal } : ALLOW;
};

const toolVerdict = (
  observing: Observing,
  watched: { readonly bound: Bound; readonly event: HostEventAt<"before-tool"> },
): Promise<Guarded> => {
  const { bound, event } = watched;
  const refusal =
    event.tool.classified === "file-write"
      ? writeStop(
          {
            record: bound.record,
            method: bound.method,
            placement: (request) => observing.artifacts.destinationOf(request),
          },
          event.tool.subject,
        )
      : null;
  return guarded(observing, { bound, refusal });
};

const stopVerdict = async (observing: Observing, bound: Bound): Promise<Guarded> =>
  guarded(observing, {
    bound,
    refusal: forwardingStop({
      record: bound.record,
      route: nextRoute(bound.record, {
        method: bound.method,
        personAsked: "not-asked",
        time: observing.clock.now(),
      }),
      events: await observing.audit.since({ intent: bound.record.id, after: null }),
    }),
  });

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
      return { event, verdict: await toolVerdict(observing, { bound, event }) };
    case "stop":
      return { event, verdict: await stopVerdict(observing, bound) };
    case "status-line":
      return { event, verdict: { kind: "show-status", text: statusText(bound.record) } };
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
  const observing: Observing = { ...dependencies, trail: auditTrail(dependencies.audit) };
  return { observe: (event) => observe(observing, event) };
};
