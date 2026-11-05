import { expect, test } from "bun:test";
import { assessPresenceHistory, type PresenceHistory, type PresenceEvidence } from "./presence-evidence.ts";

type PresenceCase = {
  readonly name: string;
  readonly history: PresenceHistory;
  readonly expected: PresenceEvidence["kind"];
};

const cases: PresenceCase[] = [
  { name: "absence of tracking is visible rather than a fabricated human turn", history: { kind: "observed", tracking: "inactive", events: [] }, expected: "untracked" },
  { name: "tracked workflow without turns has no human evidence", history: { kind: "observed", tracking: "active", events: [] }, expected: "missing" },
  { name: "unreadable shard remains unavailable", history: { kind: "unavailable", reason: "unreadable-shard" }, expected: "unavailable" },
  { name: "unreadable shard discovery remains unavailable", history: { kind: "unavailable", reason: "unreadable-location" }, expected: "unavailable" },
  { name: "a resolution without a turn cannot prove presence", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "02", shard: "one", position: 1 }] }, expected: "missing" },
  { name: "a lone turn is fresh", history: { kind: "observed", tracking: "active", events: [{ kind: "human-turn", timestamp: "01", shard: "one", position: 0 }] }, expected: "fresh" },
  { name: "later human timestamp is fresh across shards", history: { kind: "observed", tracking: "active", events: [{ kind: "human-turn", timestamp: "02", shard: "one", position: 0 }, { kind: "resolution", timestamp: "01", shard: "two", position: 8 }] }, expected: "fresh" },
  { name: "later resolution consumes a human turn across shards", history: { kind: "observed", tracking: "active", events: [{ kind: "human-turn", timestamp: "01", shard: "one", position: 9 }, { kind: "resolution", timestamp: "02", shard: "two", position: 0 }] }, expected: "consumed" },
  { name: "same-shard append order proves a same-second fresh turn", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "01", shard: "one", position: 0 }, { kind: "human-turn", timestamp: "01", shard: "one", position: 1 }] }, expected: "fresh" },
  { name: "same-shard later resolution consumes same-second turn", history: { kind: "observed", tracking: "active", events: [{ kind: "human-turn", timestamp: "01", shard: "one", position: 0 }, { kind: "resolution", timestamp: "01", shard: "one", position: 1 }] }, expected: "consumed" },
  { name: "cross-shard order is unknown even when filename order looks later", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "01", shard: "a-first", position: 0 }, { kind: "human-turn", timestamp: "01", shard: "z-last", position: 99 }] }, expected: "unordered" },
  { name: "one unordered resolution defeats a same-shard witness", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "01", shard: "one", position: 0 }, { kind: "human-turn", timestamp: "01", shard: "one", position: 1 }, { kind: "resolution", timestamp: "01", shard: "two", position: 0 }] }, expected: "unordered" },
  { name: "a valid witness can coexist with another cross-shard human turn", history: { kind: "observed", tracking: "active", events: [{ kind: "human-turn", timestamp: "01", shard: "two", position: 0 }, { kind: "resolution", timestamp: "01", shard: "one", position: 0 }, { kind: "human-turn", timestamp: "01", shard: "one", position: 1 }] }, expected: "fresh" },
  { name: "older resolutions do not defeat fresh same-shard evidence", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "00", shard: "two", position: 50 }, { kind: "resolution", timestamp: "01", shard: "one", position: 0 }, { kind: "human-turn", timestamp: "01", shard: "one", position: 1 }] }, expected: "fresh" },
  { name: "missing timestamps retain the predecessor's append-order behavior", history: { kind: "observed", tracking: "active", events: [{ kind: "resolution", timestamp: "", shard: "one", position: 0 }, { kind: "human-turn", timestamp: "", shard: "one", position: 1 }] }, expected: "fresh" },
];

test.each(cases)("$name", ({ history, expected }) => {
  expect(assessPresenceHistory({ history }).kind).toBe(expected);
});

test("fresh evidence contains the exact supporting ledger location", () => {
  expect(assessPresenceHistory({ history: { kind: "observed", tracking: "active", events: [
    { kind: "resolution", timestamp: "2026-11-05T00:00:00Z", shard: "machine", position: 3 },
    { kind: "human-turn", timestamp: "2026-11-05T00:00:00Z", shard: "machine", position: 4 },
  ] } })).toEqual({
    kind: "fresh",
    witness: { timestamp: "2026-11-05T00:00:00Z", shard: "machine", position: 4 },
  });
});

test("assessment does not reorder or rewrite the observed ledger", () => {
  const events = Object.freeze([
    Object.freeze({ kind: "human-turn", timestamp: "02", shard: "one", position: 2 }),
    Object.freeze({ kind: "resolution", timestamp: "01", shard: "two", position: 3 }),
  ]);
  const history: PresenceHistory = Object.freeze({ kind: "observed", tracking: "active", events });
  expect(assessPresenceHistory({ history }).kind).toBe("fresh");
  expect(events).toEqual([
    { kind: "human-turn", timestamp: "02", shard: "one", position: 2 },
    { kind: "resolution", timestamp: "01", shard: "two", position: 3 },
  ]);
});

test("consumed provenance cites the later resolution rather than the already-passed boundary", () => {
  expect(assessPresenceHistory({ history: { kind: "observed", tracking: "active", events: [
    { kind: "resolution", timestamp: "01", shard: "one", position: 0 },
    { kind: "human-turn", timestamp: "01", shard: "one", position: 1 },
    { kind: "resolution", timestamp: "01", shard: "one", position: 2 },
  ] } })).toEqual({ kind: "consumed", boundaries: [{ timestamp: "01", shard: "one", position: 2 }] });
});

test("known consumption is not hidden by an additional unordered resolution", () => {
  expect(assessPresenceHistory({ history: { kind: "observed", tracking: "active", events: [
    { kind: "human-turn", timestamp: "01", shard: "one", position: 0 },
    { kind: "resolution", timestamp: "01", shard: "one", position: 1 },
    { kind: "resolution", timestamp: "01", shard: "two", position: 0 },
  ] } })).toEqual({ kind: "consumed", boundaries: [
    { timestamp: "01", shard: "one", position: 1 },
    { timestamp: "01", shard: "two", position: 0 },
  ] });
});

test("different candidate turns can be consumed by different same-shard resolutions", () => {
  expect(assessPresenceHistory({ history: { kind: "observed", tracking: "active", events: [
    { kind: "human-turn", timestamp: "01", shard: "one", position: 0 },
    { kind: "human-turn", timestamp: "01", shard: "two", position: 0 },
    { kind: "resolution", timestamp: "01", shard: "one", position: 1 },
    { kind: "resolution", timestamp: "01", shard: "two", position: 1 },
  ] } })).toEqual({ kind: "consumed", boundaries: [
    { timestamp: "01", shard: "one", position: 1 },
    { timestamp: "01", shard: "two", position: 1 },
  ] });
});
