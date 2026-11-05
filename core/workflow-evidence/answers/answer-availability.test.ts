import { expect, test } from "bun:test";
import { interpretAnswerAvailability, type AnswerObservation } from "./answer-availability.ts";

const observation: AnswerObservation = Object.freeze({ evidence: Object.freeze({ kind: "consumed", boundaries: [] }), answerReuse: Object.freeze({ kind: "reusable", basis: "questions-precede-turn", turn: { timestamp: "02", shard: "one", position: 1 }, answers: [] }) });

test("reuse permission changes consequences without rewriting consumed evidence", () => {
  const allowed = interpretAnswerAvailability({ observation, reusePermission: "allowed" });
  const disabled = interpretAnswerAvailability({ observation, reusePermission: "disabled" });
  expect(allowed).toEqual({ kind: "admitted", basis: "reused-reply", observation });
  expect(disabled).toEqual({ kind: "refused", reason: "reuse-disabled", observation });
  expect(allowed.observation).toBe(observation);
  expect(disabled.observation).toBe(observation);
  expect(observation.evidence.kind).toBe("consumed");
});
test("a fresh existing reply remains usable under the predecessor unattended guard", () => {
  expect(interpretAnswerAvailability({ observation: { evidence: { kind: "fresh", witness: { timestamp: "02", shard: "one", position: 1 } }, answerReuse: { kind: "not-reusable", reason: "no-answer-consumption" } }, reusePermission: "disabled" }).kind).toBe("admitted");
});
test("untracked remains a named compatibility exemption", () => {
  expect(interpretAnswerAvailability({ observation: { evidence: { kind: "untracked" }, answerReuse: { kind: "not-reusable", reason: "no-unique-latest-turn" } }, reusePermission: "allowed" }).kind).toBe("legacy-untracked-exemption");
});
test("unavailable evidence cannot be passed off as reusable", () => {
  expect(interpretAnswerAvailability({ observation: { evidence: { kind: "unavailable", reason: "unreadable-location" }, answerReuse: { kind: "unavailable", reason: "unreadable-location" } }, reusePermission: "allowed" }).kind).toBe("refused");
});
test("a later question without reuse evidence is refused", () => {
  expect(interpretAnswerAvailability({ observation: { evidence: { kind: "consumed", boundaries: [] }, answerReuse: { kind: "not-reusable", reason: "later-question-without-picker-credit" } }, reusePermission: "allowed" }).kind).toBe("refused");
});
test("a contradictory reuse claim cannot supply a missing reply", () => {
  expect(interpretAnswerAvailability({ observation: { evidence: { kind: "missing" }, answerReuse: { kind: "reusable", basis: "questions-precede-turn", turn: { timestamp: "02", shard: "one", position: 1 }, answers: [] } }, reusePermission: "allowed" }).kind).toBe("refused");
});
