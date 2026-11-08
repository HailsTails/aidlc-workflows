import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Timestamp } from "../../kernel/values.ts";
import { transitionFacts } from "../domain/audit.ts";
import type { GuardRefusal } from "../domain/guard.ts";
import { reopenPresenceStop, transitionStop } from "../domain/guard-stops.ts";
import type { IntentId, SessionId } from "../domain/identities.ts";
import { personSinceFinished } from "../domain/presence.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import { reopenWorkflow, type WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditTrail } from "./audit-trail.ts";
import type { HumanTurnHistory } from "./boundary-ports.ts";
import type { AuditLog, Clock, RecordStore } from "./ports.ts";
import type { ReopenWorkflow } from "./use-cases.ts";

export type ReopenWorkflowDependencies = {
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly turns: HumanTurnHistory;
};

type Reopening = ReopenWorkflowDependencies & { readonly trail: AuditTrail };

type ReopenRequest = {
  readonly intent: IntentId;
  readonly session: SessionId;
};

type LoadedRequest = ReopenRequest & { readonly record: WorkflowRecord };

type Reopened = Result<WorkflowRecord, ExecutionRefusal>;

const stop = async (
  reopening: Reopening,
  stopped: { readonly request: ReopenRequest; readonly refusal: GuardRefusal },
): Promise<Reopened> => {
  await reopening.trail.record(
    { ...stopped.request, at: reopening.clock.now() },
    { kind: "guard-refused", refusal: stopped.refusal },
  );
  return refused({ kind: "guard", refusal: stopped.refusal });
};

const reopenHeard = async (reopening: Reopening, request: LoadedRequest): Promise<Reopened> => {
  const time = reopening.clock.now();
  const moved = reopenWorkflow(request.record, { time, personSinceFinished: "spoke" });
  if (!moved.ok) {
    return stop(reopening, { request, refusal: transitionStop(moved.refusal) });
  }
  const saved = await reopening.records.save({
    record: moved.value.record,
    expected: request.record.version,
  });
  if (!saved.ok) {
    return saved;
  }
  await reopening.trail.recordAll(
    { intent: request.intent, session: request.session, at: time },
    transitionFacts(moved.value.transitions),
  );
  return accepted(saved.value);
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
    ? reopenHeard(reopening, request)
    : stop(reopening, { request, refusal: reopenPresenceStop });
};

const reopen = async (reopening: Reopening, request: ReopenRequest): Promise<Reopened> => {
  const loaded = await reopening.records.load(request.intent);
  if (!loaded.ok) {
    return loaded;
  }
  const record = loaded.value;
  return record.status.kind === "completed"
    ? reopenFinished(reopening, { ...request, record, finishedAt: record.status.at })
    : reopenHeard(reopening, { ...request, record });
};

export const reopenWorkflowUseCase = (dependencies: ReopenWorkflowDependencies): ReopenWorkflow => {
  const reopening: Reopening = { ...dependencies, trail: auditTrail(dependencies.audit) };
  return { reopen: (request) => reopen(reopening, request) };
};
