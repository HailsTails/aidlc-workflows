import { describe, expect, test } from "vitest";
import {
  readNeglectClock,
  resolveNeglectDays,
} from "./rin-gates-neglect-clock.ts";

const NOW = new Date("2026-08-16T00:00:00Z");
const now = (): Date => NOW;

// The field labels are the audit shard's own wire format (PascalCase on the
// line, e.g. `**Timestamp**: ...`), so they travel as data rather than as
// object keys.
const block = (fields: readonly (readonly [string, string])[]): string =>
  fields.map(([label, value]) => `**${label}**: ${value}`).join("\n");

const shard = (blocks: readonly string[]): string =>
  ["# AI-DLC Audit Log", ...blocks].join("\n---\n");

const advance = (args: {
  readonly at: string;
  readonly stage: string;
  readonly event?: string;
}): string =>
  block([
    ["Timestamp", args.at],
    ["Event", args.event ?? "STAGE_COMPLETED"],
    ["Stage", args.stage],
  ]);

describe("readNeglectClock — level 1, stage advance", () => {
  test("a STAGE_COMPLETED on a rin gate supplies the clock", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            advance({
              at: "2026-08-01T00:00:00Z",
              stage: "rin-gate-2-plan-review",
            }),
          ]),
        ],
        promotedAt: "2026-01-01T00:00:00Z",
      }),
    ).toEqual({ source: "stage-advance", at: "2026-08-01T00:00:00Z" });
  });

  test("GATE_APPROVED also counts as an advance", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            advance({
              at: "2026-08-02T00:00:00Z",
              stage: "rin-gate-3-interface-lock",
              event: "GATE_APPROVED",
            }),
          ]),
        ],
        promotedAt: null,
      }),
    ).toEqual({ source: "stage-advance", at: "2026-08-02T00:00:00Z" });
  });

  test("the MAX across all of a record's shards wins, not the first file", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            advance({
              at: "2026-08-01T00:00:00Z",
              stage: "rin-gate-1-framing",
            }),
          ]),
          shard([
            advance({
              at: "2026-08-09T00:00:00Z",
              stage: "rin-gate-2-plan-review",
            }),
          ]),
          shard([
            advance({
              at: "2026-08-05T00:00:00Z",
              stage: "rin-gate-1-framing",
            }),
          ]),
        ],
        promotedAt: null,
      }),
    ).toEqual({ source: "stage-advance", at: "2026-08-09T00:00:00Z" });
  });

  test("the LAST matching block in a shard wins (append-only, read backwards)", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            advance({
              at: "2026-07-01T00:00:00Z",
              stage: "rin-gate-1-framing",
            }),
            advance({
              at: "2026-08-04T00:00:00Z",
              stage: "rin-gate-2-plan-review",
            }),
          ]),
        ],
        promotedAt: null,
      }),
    ).toEqual({ source: "stage-advance", at: "2026-08-04T00:00:00Z" });
  });

  // Found on the live corpus, not in fixtures: 24 shards carry the LEGACY bare
  // `gate-N-*` spelling from before the rin- prefix. Matching only the modern
  // spelling silently rejected their real advances and dropped those records to
  // a weaker clock level — a fail-open on the oldest records in the pool.
  test("the LEGACY bare 'gate-N-*' stage spelling counts as an advance", () => {
    expect(
      readNeglectClock({
        dirName: "260714-a",
        shardBodies: [
          shard([
            advance({ at: "2026-07-14T05:05:45Z", stage: "gate-0-reconcile" }),
          ]),
        ],
        promotedAt: "2026-08-01T00:00:00Z",
      }),
    ).toEqual({ source: "stage-advance", at: "2026-07-14T05:05:45Z" });
  });

  test("both spellings are compared together — the newest advance wins across them", () => {
    expect(
      readNeglectClock({
        dirName: "260714-a",
        shardBodies: [
          shard([
            advance({ at: "2026-07-14T00:00:00Z", stage: "gate-0-reconcile" }),
          ]),
          shard([
            advance({
              at: "2026-08-09T00:00:00Z",
              stage: "rin-gate-2-plan-review",
            }),
          ]),
        ],
        promotedAt: null,
      }),
    ).toEqual({ source: "stage-advance", at: "2026-08-09T00:00:00Z" });
  });

  test("a stage merely CONTAINING 'gate-' is not an advance", () => {
    expect(
      readNeglectClock({
        dirName: "260714-a",
        shardBodies: [
          shard([
            advance({ at: "2026-07-14T00:00:00Z", stage: "delegate-review" }),
          ]),
        ],
        promotedAt: "2026-08-01T00:00:00Z",
      }),
    ).toEqual({ source: "promotion-date", at: "2026-08-01T00:00:00Z" });
  });

  test("a non-gate stage is NOT an advance — bootstrap completions do not count", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            advance({
              at: "2026-08-01T00:00:00Z",
              stage: "workspace-scaffold",
            }),
          ]),
        ],
        promotedAt: "2026-02-02T00:00:00Z",
      }),
    ).toEqual({ source: "promotion-date", at: "2026-02-02T00:00:00Z" });
  });

  test("a sibling record's SENSOR_FIRED event is ignored — keys on the event, not dir presence", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [
          shard([
            block([
              ["Timestamp", "2026-08-15T00:00:00Z"],
              ["Event", "SENSOR_FIRED"],
              ["Stage", "rin-gate-0-reconcile"],
            ]),
          ]),
        ],
        promotedAt: "2026-02-02T00:00:00Z",
      }),
    ).toEqual({ source: "promotion-date", at: "2026-02-02T00:00:00Z" });
  });

  test("an unparseable shard falls through to the next level rather than throwing", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: ["absolute gibberish with no blocks"],
        promotedAt: "2026-02-02T00:00:00Z",
      }),
    ).toEqual({ source: "promotion-date", at: "2026-02-02T00:00:00Z" });
  });
});

describe("readNeglectClock — levels 2, 3 and the bottom", () => {
  test("level 2: no advance falls back to the promotion date", () => {
    expect(
      readNeglectClock({
        dirName: "260101-a",
        shardBodies: [],
        promotedAt: "2026-03-03T00:00:00Z",
      }),
    ).toEqual({ source: "promotion-date", at: "2026-03-03T00:00:00Z" });
  });

  test("level 3: neither advance nor provenance falls back to the dirName prefix", () => {
    expect(
      readNeglectClock({
        dirName: "260717-v2-plugin-reset",
        shardBodies: [],
        promotedAt: null,
      }),
    ).toEqual({ source: "dir-name-prefix", at: "2026-07-17" });
  });

  test("an UNPARSEABLE dirName prefix bottoms out at no-clock, never a silent NaN", () => {
    expect(
      readNeglectClock({
        dirName: "hand-created-record",
        shardBodies: [],
        promotedAt: null,
      }),
    ).toEqual({ source: "no-clock" });
  });

  test("a numeric-but-invalid date prefix also bottoms out at no-clock", () => {
    expect(
      readNeglectClock({
        dirName: "269999-impossible-date",
        shardBodies: [],
        promotedAt: null,
      }),
    ).toEqual({ source: "no-clock" });
  });
});

describe("resolveNeglectDays (the only unit touching time)", () => {
  test("a 10-day-old advance resolves to 10 days", () => {
    expect(
      resolveNeglectDays({
        clock: { source: "stage-advance", at: "2026-08-06T00:00:00Z" },
        now,
      }),
    ).toBe(10);
  });

  test("no-clock resolves to POSITIVE_INFINITY — maximally neglected, absolutely encoded", () => {
    expect(resolveNeglectDays({ clock: { source: "no-clock" }, now })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  test("an unparseable timestamp fails CLOSED to infinity, never to NaN", () => {
    expect(
      resolveNeglectDays({
        clock: { source: "promotion-date", at: "not-a-date" },
        now,
      }),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  test("the resolved value is a real number for every real clock level", () => {
    const days = resolveNeglectDays({
      clock: { source: "dir-name-prefix", at: "2026-07-17" },
      now,
    });
    expect(Number.isNaN(days)).toBe(false);
    expect(days).toBeGreaterThan(0);
  });
});
