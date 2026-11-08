import { accepted, refused, type Result } from "../../kernel/result.ts";
import { transitionFacts } from "../domain/audit.ts";
import type { Gate, GateDecision, HumanEvidence } from "../domain/gate.ts";
import { decideAtGate, type GateOutcome } from "../domain/gate-decision.ts";
import type { GuardRefusal } from "../domain/guard.ts";
import { presenceStop, transitionStop } from "../domain/guard-stops.ts";
import type { IntentId, PlanFingerprint, SessionId } from "../domain/identities.ts";
import { gateOpening, presenceIn, type Presence } from "../domain/presence.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditTrail } from "./audit-trail.ts";
import type { HumanTurnHistory } from "./boundary-ports.ts";
import type { AuditLog, Clock, PlanFingerprints, RecordStore } from "./ports.ts";
import type { DecideAtGate } from "./use-cases.ts";

export type DecideAtGateDependencies = {
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly turns: HumanTurnHistory;
  readonly plans: PlanFingerprints;
};

type Deciding = DecideAtGateDependencies & { readonly trail: AuditTrail };

type GateRequest = {
  readonly intent: IntentId;
  readonly gate: Gate;
  readonly decision: GateDecision;
  readonly session: SessionId;
};

type HeardRequest = GateRequest & {
  readonly record: WorkflowRecord;
  readonly evidence: HumanEvidence;
};

type Decided = Result<WorkflowRecord, ExecutionRefusal>;

const stop = async (
  deciding: Deciding,
  stopped: { readonly request: GateRequest; readonly refusal: GuardRefusal },
): Promise<Decided> => {
  await deciding.trail.record(
    { intent: stopped.request.intent, session: stopped.request.session, at: deciding.clock.now() },
    { kind: "guard-refused", refusal: stopped.refusal },
  );
  return refused({ kind: "guard", refusal: stopped.refusal });
};

const presenceOf = async (
  deciding: Deciding,
  request: GateRequest & { readonly record: WorkflowRecord },
): Promise<Presence | null> => {
  const opening = gateOpening({
    gate: request.gate,
    session: request.session,
    events: await deciding.audit.since({ intent: request.intent, after: null }),
    approvals: request.record.approvals,
  });
  return opening.kind === "opened"
    ? presenceIn(
        opening.window,
        await deciding.turns.humanTurnsSince({
          session: request.session,
          from: opening.window.openedAt,
        }),
      )
    : null;
};

const fingerprintOf = (deciding: Deciding, request: GateRequest): Promise<PlanFingerprint | null> =>
  request.gate.kind === "plan-approval"
    ? deciding.plans.current({
        intent: request.intent,
        stage: request.gate.stage,
        unit: request.gate.unit,
      })
    : Promise.resolve(null);

const recordOutcome = async (
  deciding: Deciding,
  saved: { readonly request: GateRequest; readonly outcome: GateOutcome },
): Promise<void> => {
  const { request, outcome } = saved;
  await deciding.trail.recordCaused({
    scene: { intent: request.intent, session: request.session, at: outcome.approval.decidedAt },
    cause: { kind: "gate-decided", approval: outcome.approval },
    effects: transitionFacts(outcome.transitions),
  });
};

const saveOutcome = async (
  deciding: Deciding,
  decided: { readonly request: HeardRequest; readonly outcome: GateOutcome },
): Promise<Decided> => {
  const saved = await deciding.records.save({
    record: decided.outcome.record,
    expected: decided.request.record.version,
  });
  if (!saved.ok) {
    return saved;
  }
  await recordOutcome(deciding, decided);
  return accepted(saved.value);
};

const decideHeard = async (deciding: Deciding, request: HeardRequest): Promise<Decided> => {
  const outcome = decideAtGate(request.record, {
    ...request,
    fingerprint: await fingerprintOf(deciding, request),
    time: deciding.clock.now(),
  });
  return outcome.ok
    ? saveOutcome(deciding, { request, outcome: outcome.value })
    : stop(deciding, { request, refusal: transitionStop(outcome.refusal) });
};

const decide = async (deciding: Deciding, request: GateRequest): Promise<Decided> => {
  const loaded = await deciding.records.load(request.intent);
  if (!loaded.ok) {
    return loaded;
  }
  const record = loaded.value;
  const presence = await presenceOf(deciding, { ...request, record });
  return presence?.kind === "present"
    ? decideHeard(deciding, { ...request, record, evidence: presence.evidence })
    : stop(deciding, { request, refusal: presenceStop(request.gate) });
};

export const decideAtGateUseCase = (dependencies: DecideAtGateDependencies): DecideAtGate => {
  const deciding: Deciding = { ...dependencies, trail: auditTrail(dependencies.audit) };
  return { decide: (request) => decide(deciding, request) };
};
