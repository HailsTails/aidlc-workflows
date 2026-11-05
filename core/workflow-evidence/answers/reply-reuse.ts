import type { LedgerPosition } from "../presence/presence-evidence.ts";

export type ReplyConsumption = LedgerPosition & { readonly kind: "answer" | "other" };
export type ReplyHistory = {
  readonly turns: readonly LedgerPosition[];
  readonly resolutions: readonly ReplyConsumption[];
  readonly questions: readonly LedgerPosition[];
  readonly picks: readonly { readonly shard: string; readonly turnPosition: number }[];
};
export type ReplyReuseEvidence =
  | { readonly kind: "unavailable"; readonly reason: "unreadable-shard" | "unreadable-location" }
  | { readonly kind: "reusable"; readonly basis: "questions-precede-turn"; readonly turn: LedgerPosition; readonly answers: readonly LedgerPosition[] }
  | { readonly kind: "reusable"; readonly basis: "picker-replies-remain"; readonly turn: LedgerPosition; readonly answers: readonly LedgerPosition[]; readonly remainingPicks: number }
  | { readonly kind: "not-reusable"; readonly reason: "no-unique-latest-turn" | "unordered-resolution" | "no-answer-consumption" | "other-consumption" | "later-question-without-picker-credit" };

const positionOf = ({ position }: { readonly position: LedgerPosition }): LedgerPosition => ({ timestamp: position.timestamp, shard: position.shard, position: position.position });
const followsTurn = ({ position, turn }: { readonly position: LedgerPosition; readonly turn: LedgerPosition }): "after" | "not-after" =>
  position.timestamp > turn.timestamp || (position.timestamp === turn.timestamp && position.shard === turn.shard && position.position > turn.position) ? "after" : "not-after";
const precedesTurn = ({ position, turn }: { readonly position: LedgerPosition; readonly turn: LedgerPosition }): "before" | "not-before" =>
  position.timestamp < turn.timestamp || (position.timestamp === turn.timestamp && position.shard === turn.shard && position.position < turn.position) ? "before" : "not-before";

const assessQuestions = ({ history, turn, answers }: { readonly history: ReplyHistory; readonly turn: LedgerPosition; readonly answers: readonly LedgerPosition[] }): ReplyReuseEvidence => {
  if (history.questions.every((position) => precedesTurn({ position, turn }) === "before")) {
    return { kind: "reusable", basis: "questions-precede-turn", turn: positionOf({ position: turn }), answers };
  }
  const pickCount = history.picks.filter((pick) => pick.shard === turn.shard && pick.turnPosition === turn.position).length;
  const remainingPicks = pickCount - answers.length;
  if (remainingPicks > 0) return { kind: "reusable", basis: "picker-replies-remain", turn: positionOf({ position: turn }), answers, remainingPicks };
  return { kind: "not-reusable", reason: "later-question-without-picker-credit" };
};

export const assessReplyReuse = ({ history }: { readonly history: ReplyHistory }): ReplyReuseEvidence => {
  const latestTimestamp = history.turns.reduce((latest, turn) => turn.timestamp > latest ? turn.timestamp : latest, "");
  const latest = history.turns.filter((turn) => turn.timestamp === latestTimestamp);
  const turn = latest[0];
  if (latest.length !== 1 || !turn) return { kind: "not-reusable", reason: "no-unique-latest-turn" };
  if (history.resolutions.some((resolution) => resolution.timestamp === turn.timestamp && resolution.shard !== turn.shard)) {
    return { kind: "not-reusable", reason: "unordered-resolution" };
  }
  const after = history.resolutions.filter((position) => followsTurn({ position, turn }) === "after");
  if (after.length === 0) return { kind: "not-reusable", reason: "no-answer-consumption" };
  if (after.some((resolution) => resolution.kind !== "answer")) return { kind: "not-reusable", reason: "other-consumption" };
  return assessQuestions({ history, turn, answers: after.map((position) => positionOf({ position })) });
};
