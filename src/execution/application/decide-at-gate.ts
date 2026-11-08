import { accepted, refused, type Result } from "../../kernel/result.ts";
import { transitionFacts } from "../domain/audit.ts";
import type { ApprovalBasis, Gate, GateDecision } from "../domain/gate.ts";
import {
  decideAtGate,
  keepUnapplied,
  type GateDecisionRequest,
  type GateOutcome,
} from "../domain/gate-decision.ts";
import { humanPresenceRule, stateTransitionRule } from "../domain/guard-rules.ts";
import { switchOf } from "../domain/guard-standing.ts";
import type { IntentId, PlanFingerprint, SessionId } from "../domain/identities.ts";
import { gateOpening, presenceIn, type Presence } from "../domain/presence.ts";
import type { ExecutionRefusal } from "../domain/refusals.ts";
import type { RecordMoveRefusal, WorkflowRecord } from "../domain/workflow-record.ts";
import { auditTrail, type AuditScene, type AuditTrail } from "./audit-trail.ts";
import type { HumanTurnHistory } from "./boundary-ports.ts";
import type { AuditLog, Clock, GuardEnvironment, PlanFingerprints, RecordStore } from "./ports.ts";
import { heldRefusal, stopRaiser, type RaiseStop } from "./raise-stop.ts";
import type { DecideAtGate } from "./use-cases.ts";

export type DecideAtGateDependencies = {
  readonly records: RecordStore;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly turns: HumanTurnHistory;
  readonly plans: PlanFingerprints;
  readonly environment: GuardEnvironment;
};

type Deciding = DecideAtGateDependencies & {
  readonly trail: AuditTrail;
  readonly raise: RaiseStop;
};

type GateRequest = {
  readonly intent: IntentId;
  readonly gate: Gate;
  readonly decision: GateDecision;
  readonly session: SessionId;
};

type LoadedRequest = GateRequest & { readonly record: WorkflowRecord };

type Decided = Result<WorkflowRecord, ExecutionRefusal>;

type GateHearing = Presence | { readonly kind: "unopened" };

const sceneOf = (deciding: Deciding, request: GateRequest): AuditScene => ({
  intent: request.intent,
  session: request.session,
  at: deciding.clock.now(),
});

const hearingOf = async (deciding: Deciding, request: LoadedRequest): Promise<GateHearing> => {
  const opening = gateOpening({
    gate: request.gate,
    session: request.session,
    events: await deciding.audit.since({ intent: request.intent, after: null }),
    approvals: request.record.approvals,
  });
  return opening.kind === "opened"
    ? presenceIn(
        opening.window,
        await deciding.turns.humanTurnsSince({ session: request.session, from: opening.window.openedAt }),
      )
    : { kind: "unopened" };
};

const liftedBasis = async (
  deciding: Deciding,
  unheard: { readonly request: LoadedRequest; readonly heard: "unopened" | "absent" },
): Promise<Result<ApprovalBasis, ExecutionRefusal>> => {
  const { request } = unheard;
  const stop = humanPresenceRule.check({ asked: "gate", gate: request.gate, heard: unheard.heard });
  const verdict = await deciding.raise({
    refusal: stop,
    record: request.record,
    scene: sceneOf(deciding, request),
    after: null,
  });
  const lift = verdict.kind === "stands-aside" ? switchOf(verdict.because) : null;
  return lift === null
    ? refused({ kind: "guard", refusal: heldRefusal(verdict, stop) })
    : accepted({ kind: "presence-stood-aside", lift });
};

const basisOf = async (
  deciding: Deciding,
  request: LoadedRequest,
): Promise<Result<ApprovalBasis, ExecutionRefusal>> => {
  const hearing = await hearingOf(deciding, request);
  return hearing.kind === "present"
    ? accepted({ kind: "human", evidence: hearing.evidence })
    : liftedBasis(deciding, { request, heard: hearing.kind });
};

const fingerprintOf = (deciding: Deciding, request: GateRequest): Promise<PlanFingerprint | null> =>
  request.gate.kind === "plan-approval"
    ? deciding.plans.current({ intent: request.intent, stage: request.gate.stage, unit: request.gate.unit })
    : Promise.resolve(null);

const saveOutcome = async (
  deciding: Deciding,
  decided: { readonly request: LoadedRequest; readonly outcome: GateOutcome },
): Promise<Decided> => {
  const { request, outcome } = decided;
  const saved = await deciding.records.save({ record: outcome.record, expected: request.record.version });
  if (saved.ok) {
    await deciding.trail.recordCaused({
      scene: { ...sceneOf(deciding, request), at: outcome.approval.decidedAt },
      cause: { kind: "gate-decided", approval: outcome.approval },
      effects: transitionFacts(outcome.transitions),
    });
  }
  return saved;
};

const keepRefused = async (
  deciding: Deciding,
  kept: {
    readonly request: LoadedRequest;
    readonly decision: GateDecisionRequest;
    readonly refusal: RecordMoveRefusal;
  },
): Promise<Decided> => {
  const { request } = kept;
  const stop = stateTransitionRule.check(kept.refusal);
  const outcome = keepUnapplied(request.record, { request: kept.decision, refusal: stop });
  const saved = await deciding.records.save({ record: outcome.record, expected: request.record.version });
  if (!saved.ok) {
    return saved;
  }
  const decided = await deciding.trail.record(
    { ...sceneOf(deciding, request), at: outcome.approval.decidedAt },
    { kind: "gate-decided", approval: outcome.approval },
  );
  const verdict = await deciding.raise({
    refusal: stop,
    record: saved.value,
    scene: sceneOf(deciding, request),
    after: decided,
  });
  return refused({ kind: "guard", refusal: heldRefusal(verdict, stop) });
};

const decideWith = async (
  deciding: Deciding,
  based: { readonly request: LoadedRequest; readonly basis: ApprovalBasis },
): Promise<Decided> => {
  const { request } = based;
  const decision: GateDecisionRequest = {
    gate: request.gate,
    decision: request.decision,
    basis: based.basis,
    fingerprint: await fingerprintOf(deciding, request),
    time: deciding.clock.now(),
  };
  const outcome = decideAtGate(request.record, decision);
  return outcome.ok
    ? saveOutcome(deciding, { request, outcome: outcome.value })
    : keepRefused(deciding, { request, decision, refusal: outcome.refusal });
};

const decide = async (deciding: Deciding, request: GateRequest): Promise<Decided> => {
  const loaded = await deciding.records.load(request.intent);
  if (!loaded.ok) {
    return loaded;
  }
  const loadedRequest = { ...request, record: loaded.value };
  const basis = await basisOf(deciding, loadedRequest);
  return basis.ok ? decideWith(deciding, { request: loadedRequest, basis: basis.value }) : basis;
};

export const decideAtGateUseCase = (dependencies: DecideAtGateDependencies): DecideAtGate => {
  const deciding: Deciding = {
    ...dependencies,
    trail: auditTrail(dependencies.audit),
    raise: stopRaiser(dependencies),
  };
  return { decide: (request) => decide(deciding, request) };
};
