import type { Timestamp } from "../../kernel/values.ts";
import type { Phase } from "../../workflow-definition/domain/vocabulary.ts";
import type { Gate, HumanEvidence } from "./gate.ts";
import type { SessionId } from "./identities.ts";
import { orderOf } from "./moment.ts";
import type { AutonomyMode } from "./workflow-record.ts";

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
