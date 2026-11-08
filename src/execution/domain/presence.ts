import type { Timestamp } from "../../kernel/values.ts";
import type { StageSlug } from "../../workflow-definition/domain/identities.ts";
import type { Phase } from "../../workflow-definition/domain/vocabulary.ts";
import type { AuditEvent } from "./audit.ts";
import type { Approval, Gate, HumanEvidence } from "./gate.ts";
import type { SessionId, UnitName } from "./identities.ts";
import { orderOf } from "./moment.ts";
import type { AutonomyMode, StageProgress } from "./workflow-record.ts";

export type PresenceWindow = {
  readonly session: SessionId;
  readonly openedAt: Timestamp;
  readonly lastDecisionAt: Timestamp | null;
};

export type Presence =
  | { readonly kind: "present"; readonly evidence: HumanEvidence }
  | { readonly kind: "absent"; readonly window: PresenceWindow };

export type PresenceRequirement = "person-decides" | "engine-may-decide";

export type GateSetting = {
  readonly gate: Gate;
  readonly phase: Phase;
  readonly autonomy: AutonomyMode;
};

type TurnReading = "stands" | "outside";

const afterOpening = (turn: HumanEvidence, window: PresenceWindow): TurnReading =>
  orderOf(turn.observedAt, window.openedAt) === "earlier" ? "outside" : "stands";

const unspent = (turn: HumanEvidence, window: PresenceWindow): TurnReading =>
  window.lastDecisionAt === null || orderOf(turn.observedAt, window.lastDecisionAt) === "later"
    ? "stands"
    : "outside";

const turnReading = (turn: HumanEvidence, window: PresenceWindow): TurnReading =>
  turn.session === window.session &&
  afterOpening(turn, window) === "stands" &&
  unspent(turn, window) === "stands"
    ? "stands"
    : "outside";

const latestOf = (latest: HumanEvidence | null, turn: HumanEvidence): HumanEvidence =>
  latest === null || orderOf(turn.observedAt, latest.observedAt) !== "earlier" ? turn : latest;

export const presenceIn = (window: PresenceWindow, turns: readonly HumanEvidence[]): Presence => {
  const latest = turns
    .filter((turn) => turnReading(turn, window) === "stands")
    .reduce<HumanEvidence | null>(latestOf, null);
  return latest === null ? { kind: "absent", window } : { kind: "present", evidence: latest };
};

export const presenceRequirement = (setting: GateSetting): PresenceRequirement =>
  setting.gate.kind === "stage" &&
  setting.phase === "construction" &&
  setting.autonomy === "autonomous"
    ? "engine-may-decide"
    : "person-decides";

export type GateOpening =
  | { readonly kind: "opened"; readonly window: PresenceWindow }
  | { readonly kind: "unopened"; readonly gate: Gate };

type GatePlace = {
  readonly stages: readonly StageSlug[];
  readonly unit: UnitName | null;
  readonly opensOn: StageProgress | "any";
};

const placeOfGate = (gate: Gate): GatePlace => {
  switch (gate.kind) {
    case "stage":
      return { stages: [gate.stage], unit: gate.unit, opensOn: "awaiting-approval" };
    case "plan-approval":
      return { stages: [gate.stage], unit: gate.unit, opensOn: "in-progress" };
    case "checkpoint":
      return { stages: gate.checkpoint.stages, unit: gate.checkpoint.unit, opensOn: "any" };
  }
};

const opensAt = (event: AuditEvent, place: GatePlace): Timestamp | null => {
  const { fact } = event;
  if (fact.kind !== "transition" || fact.transition.kind !== "stage") {
    return null;
  }
  const { transition } = fact;
  return place.stages.includes(transition.stage) &&
    transition.unit === place.unit &&
    (place.opensOn === "any" || place.opensOn === transition.to)
    ? transition.at
    : null;
};

const latestDecision = (approvals: readonly Approval[]): Timestamp | null =>
  approvals.at(-1)?.decidedAt ?? null;

export type GateWindowRequest = {
  readonly gate: Gate;
  readonly session: SessionId;
  readonly events: readonly AuditEvent[];
  readonly approvals: readonly Approval[];
};

export const gateOpening = (request: GateWindowRequest): GateOpening => {
  const place = placeOfGate(request.gate);
  const openedAt = request.events
    .flatMap((event) => opensAt(event, place) ?? [])
    .at(-1);
  return openedAt === undefined
    ? { kind: "unopened", gate: request.gate }
    : {
        kind: "opened",
        window: {
          session: request.session,
          openedAt,
          lastDecisionAt: latestDecision(request.approvals),
        },
      };
};

export type FinishedWindow = {
  readonly session: SessionId;
  readonly finishedAt: Timestamp;
};

export const personSinceFinished = (
  window: FinishedWindow,
  turns: readonly HumanEvidence[],
): "spoke" | "silent" =>
  presenceIn({ session: window.session, openedAt: window.finishedAt, lastDecisionAt: null }, turns)
    .kind === "present"
    ? "spoke"
    : "silent";
