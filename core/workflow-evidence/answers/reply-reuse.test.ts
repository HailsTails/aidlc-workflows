import { expect, test } from "bun:test";
import { assessReplyReuse } from "./reply-reuse.ts";

const turn = Object.freeze({ timestamp: "02", shard: "one", position: 1 });
const answer = Object.freeze({ kind: "answer", timestamp: "02", shard: "one", position: 2 } as const);
const earlierQuestion = Object.freeze({ timestamp: "02", shard: "one", position: 0 });
const laterQuestion = Object.freeze({ timestamp: "03", shard: "one", position: 3 });

test("one reply supports questions already on record without becoming fresh", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [answer], questions: [earlierQuestion], picks: [] } })).toEqual({ kind: "reusable", basis: "questions-precede-turn", turn, answers: [{ timestamp: "02", shard: "one", position: 2 }] });
});
test("a later question needs another reply when no picker credit remains", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [answer], questions: [laterQuestion], picks: [] } })).toEqual({ kind: "not-reusable", reason: "later-question-without-picker-credit" });
});
test("remaining picks cover questions logged after their picker reply", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [answer], questions: [laterQuestion], picks: [{ shard: "one", turnPosition: 1 }, { shard: "one", turnPosition: 1 }] } })).toEqual({ kind: "reusable", basis: "picker-replies-remain", turn, answers: [{ timestamp: "02", shard: "one", position: 2 }], remainingPicks: 1 });
});
test("spent picker credit cannot answer another later question", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [answer], questions: [laterQuestion], picks: [{ shard: "one", turnPosition: 1 }] } })).toEqual({ kind: "not-reusable", reason: "later-question-without-picker-credit" });
});
test("another turn's pick cannot supply credit", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [answer], questions: [laterQuestion], picks: [{ shard: "two", turnPosition: 1 }, { shard: "one", turnPosition: 0 }] } })).toEqual({ kind: "not-reusable", reason: "later-question-without-picker-credit" });
});
test("a non-answer decision prevents reuse", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [{ kind: "other", timestamp: "03", shard: "one", position: 2 }], questions: [earlierQuestion], picks: [] } })).toEqual({ kind: "not-reusable", reason: "other-consumption" });
});
test("same-time cross-shard resolution has no provable reuse ordering", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [{ kind: "answer", timestamp: "02", shard: "two", position: 2 }], questions: [], picks: [] } })).toEqual({ kind: "not-reusable", reason: "unordered-resolution" });
});
test("two latest turns are not treated as a unique picker reply", () => {
  expect(assessReplyReuse({ history: { turns: [turn, { timestamp: "02", shard: "two", position: 0 }], resolutions: [answer], questions: [], picks: [] } })).toEqual({ kind: "not-reusable", reason: "no-unique-latest-turn" });
});
test("no reply provides no reusable evidence", () => {
  expect(assessReplyReuse({ history: { turns: [], resolutions: [], questions: [], picks: [] } })).toEqual({ kind: "not-reusable", reason: "no-unique-latest-turn" });
});
test("an unused reply is left to fresh-presence policy", () => {
  expect(assessReplyReuse({ history: { turns: [turn], resolutions: [], questions: [earlierQuestion], picks: [] } })).toEqual({ kind: "not-reusable", reason: "no-answer-consumption" });
});
