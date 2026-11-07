// Literal observations exercise attempt policy without the audit decoder or filesystem.
import { expect, test } from "bun:test";
import { attemptEventPosition, attemptFloor, isolatedAttemptState, latestIsolatedStart } from "./aidlc-attempt-boundary.ts";
import type { AttemptFloor, AttemptObservation, AttemptPosition, AttemptScope, AttemptState } from "./aidlc-attempt-boundary.ts";

type Row = AttemptPosition & { readonly id: string };
const pipeline: AttemptScope = { stage: "build", mode: "pipeline", rejection: "reset" };
const isolated: AttemptScope = { stage: "build", mode: "isolated", rejection: "reset" };
function row(changes: Partial<Row> = {}): Row {
  return { id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4, ...changes };
}
function observation(changes: Partial<AttemptObservation<Row>> = {}): AttemptObservation<Row> {
  return { source: row(), stage: "build", workflow: { mode: "pipeline" }, action: "stage-start", ...changes };
}
const isolatedStart = observation({ workflow: { mode: "isolated", stage: "build" } });

const boundaryCases: { label: string; observation: AttemptObservation<Row>; scope: AttemptScope; expected: AttemptFloor<Row> | null }[] = [
  { label: "pipeline stage start", observation: observation(), scope: pipeline, expected: { timestamp: "10", rows: [{ id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4 }] } },
  { label: "other stage start", observation: observation({ stage: "test" }), scope: pipeline, expected: null },
  { label: "missing stage", observation: observation({ stage: null }), scope: pipeline, expected: null },
  { label: "workflow start ignores stage", observation: observation({ action: "workflow-start", stage: null }), scope: pipeline, expected: { timestamp: "10", rows: [{ id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4 }] } },
  { label: "reaching jump ignores stage", observation: observation({ action: "jump-reaches", stage: "test" }), scope: pipeline, expected: { timestamp: "10", rows: [{ id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4 }] } },
  { label: "rejection resets receipts", observation: observation({ action: "rejection" }), scope: pipeline, expected: { timestamp: "10", rows: [{ id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4 }] } },
  { label: "rejection can retain receipts", observation: observation({ action: "rejection" }), scope: { ...pipeline, rejection: "retain" }, expected: null },
  { label: "other stage rejection", observation: observation({ action: "rejection", stage: "test" }), scope: pipeline, expected: null },
  { label: "completion is evidence", observation: observation({ action: "stage-complete" }), scope: pipeline, expected: null },
  { label: "unrelated is evidence", observation: observation({ action: "unrelated" }), scope: pipeline, expected: null },
  { label: "pipeline excludes isolated start", observation: isolatedStart, scope: pipeline, expected: null },
  { label: "isolated includes own start", observation: isolatedStart, scope: isolated, expected: { timestamp: "10", rows: [{ id: "start", timestamp: "10", shard: "a", shardIndex: 0, pos: 4 }] } },
  { label: "isolated excludes pipeline start", observation: observation(), scope: isolated, expected: null },
  { label: "isolated excludes other stream", observation: observation({ workflow: { mode: "isolated", stage: "test" } }), scope: isolated, expected: null },
  { label: "isolated excludes workflow start", observation: { ...isolatedStart, action: "workflow-start" }, scope: isolated, expected: null },
  { label: "isolated excludes jump", observation: { ...isolatedStart, action: "jump-reaches" }, scope: isolated, expected: null },
  { label: "isolated excludes rejection", observation: { ...isolatedStart, action: "rejection" }, scope: isolated, expected: null },
];
test.each(boundaryCases)("$label", ({ observation: entry, scope, expected }) => {
  expect(attemptFloor([entry], scope)).toEqual(expected);
});

test("floor retains every row at the last supplied boundary timestamp in input order", () => {
  const first = observation({ source: row({ id: "first", timestamp: "2" }) });
  const later = observation({ source: row({ id: "later", timestamp: "9" }) });
  const last = observation({ source: row({ id: "last", timestamp: "2", shard: "b" }) });
  const floor = attemptFloor([first, later, last], pipeline);
  expect(floor?.timestamp).toBe("2");
  expect(floor?.rows).toEqual([
    { id: "first", timestamp: "2", shard: "a", shardIndex: 0, pos: 4 },
    { id: "last", timestamp: "2", shard: "b", shardIndex: 0, pos: 4 },
  ]);
  expect(floor?.rows[0]).toBe(first.source);
  expect(floor?.rows[1]).toBe(last.source);
});

test("a repeated boundary keeps its row alias and multiplicity", () => {
  const entry = observation();
  const floor = attemptFloor(Object.freeze([entry, entry]), pipeline);
  expect(floor?.rows).toHaveLength(2);
  expect(floor?.rows[0]).toBe(entry.source);
  expect(floor?.rows[1]).toBe(entry.source);
});

test("no boundaries means no floor", () => {
  expect(attemptFloor([], pipeline)).toBeNull();
  expect(attemptFloor([observation({ action: "unrelated" })], pipeline)).toBeNull();
});

const positionCases: { label: string; entry: Row; floor: AttemptFloor<Row> | null; expected: "after" | "not-after" }[] = [
  { label: "no floor", entry: row(), floor: null, expected: "after" },
  { label: "later timestamp across shards", entry: row({ timestamp: "11", shard: "b" }), floor: { timestamp: "10", rows: [row()] }, expected: "after" },
  { label: "earlier timestamp", entry: row({ timestamp: "09", pos: 99 }), floor: { timestamp: "10", rows: [row()] }, expected: "not-after" },
  { label: "same row", entry: row(), floor: { timestamp: "10", rows: [row()] }, expected: "not-after" },
  { label: "same shard later position", entry: row({ pos: 5 }), floor: { timestamp: "10", rows: [row()] }, expected: "after" },
  { label: "same shard earlier position", entry: row({ pos: 3 }), floor: { timestamp: "10", rows: [row()] }, expected: "not-after" },
  { label: "maximum boundary position", entry: row({ pos: 5 }), floor: { timestamp: "10", rows: [row({ pos: 6 }), row()] }, expected: "not-after" },
  { label: "different shard", entry: row({ shard: "b", pos: 99 }), floor: { timestamp: "10", rows: [row()] }, expected: "not-after" },
  { label: "ambiguous floor", entry: row({ pos: 99 }), floor: { timestamp: "10", rows: [row(), row({ shard: "b" })] }, expected: "not-after" },
  { label: "empty floor tie", entry: row(), floor: { timestamp: "10", rows: [] }, expected: "not-after" },
  { label: "empty floor later", entry: row({ timestamp: "11" }), floor: { timestamp: "10", rows: [] }, expected: "after" },
  { label: "numeric strings remain lexical", entry: row({ timestamp: "2" }), floor: { timestamp: "10", rows: [row()] }, expected: "after" },
  { label: "arbitrary strings remain lexical", entry: row({ timestamp: "a" }), floor: { timestamp: "Z", rows: [row()] }, expected: "after" },
];
test.each(positionCases)("$label", ({ entry, floor, expected }) => {
  expect(attemptEventPosition(entry, floor)).toBe(expected);
});

const stateCases: { label: string; events: AttemptObservation<Row>[]; expected: AttemptState }[] = [
  { label: "absent start", events: [], expected: "not-started" },
  { label: "open start", events: [isolatedStart], expected: "open" },
  { label: "two start shards", events: [isolatedStart, { ...isolatedStart, source: row({ shard: "b" }) }], expected: "ambiguous" },
  { label: "later completion", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", source: row({ timestamp: "11" }) }], expected: "completed" },
  { label: "same shard completion appended", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", source: row({ pos: 5 }) }], expected: "completed" },
  { label: "cross-shard completion tie", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", source: row({ shard: "b" }) }], expected: "ambiguous" },
  { label: "same-position completion", events: [isolatedStart, { ...isolatedStart, action: "stage-complete" }], expected: "open" },
  { label: "earlier completion", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", source: row({ timestamp: "09" }) }], expected: "open" },
  { label: "other stage completion", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", stage: "test", source: row({ pos: 5 }) }], expected: "open" },
  { label: "pipeline completion", events: [isolatedStart, observation({ action: "stage-complete", source: row({ pos: 5 }) })], expected: "open" },
  { label: "restarted after completion", events: [isolatedStart, { ...isolatedStart, action: "stage-complete", source: row({ pos: 5 }) }, { ...isolatedStart, source: row({ pos: 6 }) }], expected: "open" },
];
test.each(stateCases)("$label", ({ events, expected }) => {
  expect(isolatedAttemptState(events, "build")).toBe(expected);
});

test("latest start sorts lexically then by shard index and position, without changing input", () => {
  const events = Object.freeze([
    { ...isolatedStart, source: row({ id: "winner", timestamp: "2", shardIndex: 2, pos: 8 }) },
    { ...isolatedStart, source: row({ id: "shard", timestamp: "2", shardIndex: 1, pos: 99 }) },
    { ...isolatedStart, source: row({ id: "position", timestamp: "2", shardIndex: 2, pos: 7 }) },
    { ...isolatedStart, source: row({ id: "timestamp", timestamp: "10", shardIndex: 9, pos: 99 }) },
  ]);
  expect(latestIsolatedStart(events, "build")?.id).toBe("winner");
  expect(latestIsolatedStart(events, "build")).toBe(events[0].source);
  expect(events[0].source.id).toBe("winner");
  expect(events[1].source.id).toBe("shard");
  expect(events[2].source.id).toBe("position");
  expect(events[3].source.id).toBe("timestamp");
});

test("all-key ties keep the last supplied source and absent streams return null", () => {
  const first = { ...isolatedStart, source: row({ id: "first" }) };
  const last = { ...isolatedStart, source: row({ id: "last" }) };
  expect(latestIsolatedStart([first, last], "build")).toBe(last.source);
  expect(latestIsolatedStart([first, last], "test")).toBeNull();
  expect(latestIsolatedStart([], "build")).toBeNull();
});
