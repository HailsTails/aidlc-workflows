import { refused, type Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import { transitionFacts } from "../domain/audit.ts";
import type { GuardRefusal } from "../domain/guard.ts";
import type { GuardVerdict } from "../domain/guard-standing.ts";
import { humanPresenceRule, stateTransitionRule } from "../domain/guard-rules.ts";
import type { IntentId, SessionId } from "../domain/identities.ts";
import { personSinceFinished } from "../domain/presence.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import { reopenWorkflow, type WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditTrail } from "./audit-trail.ts";
import type { HumanTurnHistory } from "./boundary-ports.ts";
import type { AuditLog, Clock, GuardEnvironment, RecordStore } from "./ports.ts";
import { heldRefusal, stopRaiser, type RaiseStop } from "./raise-stop.ts";
import type { ReopenWorkflow } from "./use-cases.ts";

export type ReopenWorkflowDependencies = {
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly turns: HumanTurnHistory;
  readonly environment: GuardEnvironment;
};

type Reopening = ReopenWorkflowDependencies & {
  readonly trail: AuditTrail;
  readonly raise: RaiseStop;
};

type ReopenRequest = {
  readonly intent: IntentId;
  readonly session: SessionId;
};

type LoadedRequest = ReopenRequest & { readonly record: WorkflowRecord };

type Reopened = Result<WorkflowRecord, ExecutionRefusal>;

const raised = (
  reopening: Reopening,
  stopped: { readonly request: LoadedRequest; readonly refusal: GuardRefusal },
): Promise<GuardVerdict> =>
  reopening.raise({
    refusal: stopped.refusal,
    record: stopped.request.record,
    scene: {
      intent: stopped.request.intent,
      session: stopped.request.session,
      at: reopening.clock.now(),
    },
    after: null,
  });

const reopenAs = async (
  reopening: Reopening,
  heard: { readonly request: LoadedRequest; readonly personSinceFinished: "spoke" | "silent" },
): Promise<Reopened> => {
  const { request } = heard;
  const time = reopening.clock.now();
  const moved = reopenWorkflow(request.record, { time, personSinceFinished: heard.personSinceFinished });
  if (!moved.ok) {
    const stop = stateTransitionRule.check(moved.refusal);
    const verdict = await raised(reopening, { request, refusal: stop });
    return refused({ kind: "guard", refusal: heldRefusal(verdict, stop) });
  }
  const saved = await reopening.records.save({
    record: moved.value.record,
    expected: request.record.version,
  });
  if (saved.ok) {
    await reopening.trail.recordAll(
      { intent: request.intent, session: request.session, at: time },
      transitionFacts(moved.value.transitions),
    );
  }
  return saved;
};

const reopenUnheard = async (reopening: Reopening, request: LoadedRequest): Promise<Reopened> => {
  const stop = humanPresenceRule.check({ asked: "reopen" });
  const verdict = await raised(reopening, { request, refusal: stop });
  return verdict.kind === "stands-aside"
    ? reopenAs(reopening, { request, personSinceFinished: "silent" })
    : refused({ kind: "guard", refusal: verdict.refusal });
};

const reopenFinished = async (
  reopening: Reopening,
  request: LoadedRequest & { readonly finishedAt: Timestamp },
): Promise<Reopened> => {
  const turns = await reopening.turns.humanTurnsSince({
    session: request.session,
    from: request.finishedAt,
  });
  return personSinceFinished(request, turns) === "spoke"
    ? reopenAs(reopening, { request, personSinceFinished: "spoke" })
    : reopenUnheard(reopening, request);
};

const reopen = async (reopening: Reopening, request: ReopenRequest): Promise<Reopened> => {
  const loaded = await reopening.records.load(request.intent);
  if (!loaded.ok) {
    return loaded;
  }
  const record = loaded.value;
  return record.status.kind === "completed"
    ? reopenFinished(reopening, { ...request, record, finishedAt: record.status.at })
    : reopenAs(reopening, { request: { ...request, record }, personSinceFinished: "spoke" });
};

export const reopenWorkflowUseCase = (dependencies: ReopenWorkflowDependencies): ReopenWorkflow => {
  const reopening: Reopening = {
    ...dependencies,
    trail: auditTrail(dependencies.audit),
    raise: stopRaiser(dependencies),
  };
  return { reopen: (request) => reopen(reopening, request) };
};
