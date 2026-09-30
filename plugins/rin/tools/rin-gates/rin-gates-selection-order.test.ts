import { describe, expect, test } from "vitest";
import type { MetaTier, TierValue } from "./rin-gates-importance-binding.ts";
import type { SelectionConfig } from "./rin-gates-selection-config.ts";
import {
  decideByMetaTier,
  META_TIER_DEPTH,
  type RankedRecord,
  rankMilestone,
  selectionOrderComparator,
} from "./rin-gates-selection-order.ts";

const THRESHOLD_DAYS = 30;

const config: SelectionConfig = {
  ratifiedMilestones: ["M1", "M2", "M3"],
  neglectThresholdDays: THRESHOLD_DAYS,
};

const compare = selectionOrderComparator({ config });

const record = (overrides: Partial<RankedRecord>): RankedRecord => ({
  dirName: "260101-a-record",
  flagged: "not-flagged",
  milestone: { kind: "unbound" },
  tier: { kind: "unscored" },
  neglectDays: 1,
  ...overrides,
});

const firstOf = (left: RankedRecord, right: RankedRecord): string =>
  compare(left, right) < 0 ? left.dirName : right.dirName;

describe("rung 1 — age-alarm override", () => {
  test("the sole breaching record ranks first even against a operator-flagged one", () => {
    const aged = record({ dirName: "aged", neglectDays: THRESHOLD_DAYS + 5 });
    const flagged = record({ dirName: "flagged", flagged: "operator-flagged" });
    expect(firstOf(aged, flagged)).toBe("aged");
  });

  test("the threshold boundary is INCLUSIVE — exactly at threshold breaches", () => {
    const atBoundary = record({ dirName: "at", neglectDays: THRESHOLD_DAYS });
    const fresh = record({ dirName: "fresh", neglectDays: 1 });
    expect(firstOf(atBoundary, fresh)).toBe("at");
  });

  test("one day below the threshold does not breach", () => {
    const below = record({
      dirName: "below",
      neglectDays: THRESHOLD_DAYS - 1,
      flagged: "not-flagged",
    });
    const flagged = record({ dirName: "flagged", flagged: "operator-flagged" });
    expect(firstOf(below, flagged)).toBe("flagged");
  });

  test("BOTH breaching defers to the rungs below rather than resolving", () => {
    const plainAged = record({
      dirName: "plain",
      neglectDays: THRESHOLD_DAYS + 1,
    });
    const flaggedAged = record({
      dirName: "flagged",
      neglectDays: THRESHOLD_DAYS + 1,
      flagged: "operator-flagged",
    });
    expect(firstOf(plainAged, flaggedAged)).toBe("flagged");
  });
});

describe("rung 2 — operator-flagged", () => {
  test("operator-flagged ranks above not-flagged", () => {
    expect(
      firstOf(
        record({ dirName: "plain" }),
        record({ dirName: "flagged", flagged: "operator-flagged" }),
      ),
    ).toBe("flagged");
  });

  test("lane-flagged ranks IDENTICALLY to not-flagged", () => {
    const lane = record({ dirName: "b-lane", flagged: "lane-flagged" });
    const plain = record({ dirName: "a-plain", flagged: "not-flagged" });
    expect(firstOf(lane, plain)).toBe("a-plain");
  });

  test("lane-flagged does not out-rank operator-flagged", () => {
    expect(
      firstOf(
        record({ dirName: "lane", flagged: "lane-flagged" }),
        record({ dirName: "selected-record", flagged: "operator-flagged" }),
      ),
    ).toBe("selected-record");
  });

  test("unbound ranks identically to not-flagged", () => {
    const unbound = record({ dirName: "b-unbound", flagged: "unbound" });
    const plain = record({ dirName: "a-plain", flagged: "not-flagged" });
    expect(firstOf(unbound, plain)).toBe("a-plain");
  });
});

describe("rung 4 — milestone rank", () => {
  test("a lower ratified position ranks first", () => {
    expect(
      firstOf(
        record({ dirName: "second", milestone: { kind: "ratified", rank: 1 } }),
        record({ dirName: "first", milestone: { kind: "ratified", rank: 0 } }),
      ),
    ).toBe("first");
  });

  test("equal ratified rank defers", () => {
    const left = record({
      dirName: "a",
      milestone: { kind: "ratified", rank: 0 },
      neglectDays: 5,
    });
    const right = record({
      dirName: "b",
      milestone: { kind: "ratified", rank: 0 },
      neglectDays: 9,
    });
    expect(firstOf(left, right)).toBe("b");
  });

  test("unratified defers even against a ratified record", () => {
    const unratified = record({
      dirName: "a-unratified",
      milestone: { kind: "unratified" },
      neglectDays: 9,
    });
    const ratified = record({
      dirName: "b-ratified",
      milestone: { kind: "ratified", rank: 0 },
      neglectDays: 1,
    });
    expect(firstOf(unratified, ratified)).toBe("a-unratified");
  });

  test("no-milestone defers", () => {
    const none = record({
      dirName: "a-none",
      milestone: { kind: "no-milestone" },
      neglectDays: 9,
    });
    const ratified = record({
      dirName: "b-ratified",
      milestone: { kind: "ratified", rank: 0 },
      neglectDays: 1,
    });
    expect(firstOf(none, ratified)).toBe("a-none");
  });

  test("unbound defers", () => {
    const unbound = record({
      dirName: "a-unbound",
      milestone: { kind: "unbound" },
      neglectDays: 9,
    });
    const ratified = record({
      dirName: "b-ratified",
      milestone: { kind: "ratified", rank: 0 },
      neglectDays: 1,
    });
    expect(firstOf(unbound, ratified)).toBe("a-unbound");
  });
});

describe("rung 5 — neglect age is DESCENDING", () => {
  test("more neglect ranks first", () => {
    expect(
      firstOf(
        record({ dirName: "fresh", neglectDays: 2 }),
        record({ dirName: "stale", neglectDays: 20 }),
      ),
    ).toBe("stale");
  });
});

describe("rung 6 — dirName terminal tie-break", () => {
  test("records equal on every rung resolve by dirName and never compare equal", () => {
    const left = record({ dirName: "aaa" });
    const right = record({ dirName: "bbb" });
    expect(compare(left, right)).toBeLessThan(0);
    expect(compare(right, left)).toBeGreaterThan(0);
  });

  test("the comparator never returns equal for distinct records", () => {
    const records = [
      record({ dirName: "a" }),
      record({ dirName: "b" }),
      record({ dirName: "c" }),
    ];
    const pairs = records.flatMap((left) =>
      records
        .filter((right) => right.dirName !== left.dirName)
        .map((right) => compare(left, right)),
    );
    expect(pairs.every((verdict) => verdict !== 0)).toBe(true);
  });
});

describe("order independence (FR-3)", () => {
  test("two shuffled enumerations of the same set produce identical output", () => {
    const records = [
      record({ dirName: "260101-alpha", neglectDays: 3 }),
      record({ dirName: "260102-beta", flagged: "operator-flagged" }),
      record({ dirName: "260103-gamma", neglectDays: THRESHOLD_DAYS + 2 }),
      record({ dirName: "260104-delta", neglectDays: 3 }),
    ];
    const forward = [...records].sort(compare).map((r) => r.dirName);
    const reversed = [...records]
      .reverse()
      .sort(compare)
      .map((r) => r.dirName);
    expect(forward).toEqual(reversed);
  });
});

describe("the fail-closed bottom (IF-6 x rung 5, asserted together)", () => {
  test("a no-clock record ranks FIRST against a freshly-advanced one", () => {
    expect(
      firstOf(
        record({ dirName: "fresh", neglectDays: 0 }),
        record({ dirName: "unknown", neglectDays: Number.POSITIVE_INFINITY }),
      ),
    ).toBe("unknown");
  });

  test("a no-clock record still ranks first against a genuinely aged one", () => {
    expect(
      firstOf(
        record({ dirName: "aged", neglectDays: THRESHOLD_DAYS + 100 }),
        record({ dirName: "unknown", neglectDays: Number.POSITIVE_INFINITY }),
      ),
    ).toBe("unknown");
  });
});

describe("rankMilestone (adapter resolves identifier to position)", () => {
  test("a ratified identifier resolves to its list position", () => {
    expect(
      rankMilestone({
        milestone: { kind: "milestone", identifier: "M2" },
        ratifiedMilestones: config.ratifiedMilestones,
      }),
    ).toEqual({ kind: "ratified", rank: 1 });
  });

  test("an identifier absent from the ratified list is unratified", () => {
    expect(
      rankMilestone({
        milestone: { kind: "milestone", identifier: "M9" },
        ratifiedMilestones: config.ratifiedMilestones,
      }),
    ).toEqual({ kind: "unratified" });
  });

  test("every identifier is unratified against an EMPTY ratified list", () => {
    expect(
      rankMilestone({
        milestone: { kind: "milestone", identifier: "M1" },
        ratifiedMilestones: [],
      }),
    ).toEqual({ kind: "unratified" });
  });

  test("the no-milestone state resolves to no-milestone", () => {
    expect(
      rankMilestone({
        milestone: { kind: "no-milestone" },
        ratifiedMilestones: config.ratifiedMilestones,
      }),
    ).toEqual({ kind: "no-milestone" });
  });

  test("an unbound record resolves to unbound", () => {
    expect(
      rankMilestone({
        milestone: "unbound",
        ratifiedMilestones: config.ratifiedMilestones,
      }),
    ).toEqual({ kind: "unbound" });
  });
});

// IF-11's inertness obligation, in TWO parts. Neither substitutes for the other:
// the emitted-order assertion alone passes on a rung that is never called, and
// the rung's own return value alone would not catch a wiring change that
// reordered ties. This keeps Gap `G3-C6` honest and is amended by the same
// lock-amendment ceremony that answers it — never deleted.
describe("the meta-tier rung — present, executing, and inert until G3-C6", () => {
  const SCORED_TIERS: readonly TierValue[] = ["T0", "T1", "T2", "T3"];
  const UNSCORED: MetaTier = { kind: "unscored" };

  const scoredPairs = SCORED_TIERS.flatMap((left) =>
    SCORED_TIERS.map((right): readonly [MetaTier, MetaTier] => [
      { kind: "scored", value: left },
      { kind: "scored", value: right },
    ]),
  );

  const mixedPairs = SCORED_TIERS.flatMap(
    (value): readonly (readonly [MetaTier, MetaTier])[] => [
      [{ kind: "scored", value }, UNSCORED],
      [UNSCORED, { kind: "scored", value }],
    ],
  );

  const everyTierPair: readonly (readonly [MetaTier, MetaTier])[] = [
    ...scoredPairs,
    ...mixedPairs,
    [UNSCORED, UNSCORED],
  ];

  test.each(
    everyTierPair,
  )("(a) the rung itself defers for every input pair: %j vs %j", (left, right) => {
    expect(decideByMetaTier({ left, right, depth: META_TIER_DEPTH })).toBe(0);
  });

  // The fixture corpus MUST differ in tier or (b) passes vacuously: with
  // identical tiers the rung has nothing to act on, so the assertion would stay
  // green even against a rung that ranked.
  test("(b) the emitted order is unchanged by tier, over a corpus whose tiers DIFFER", () => {
    const best = record({
      dirName: "260101-b-scored-t0",
      tier: { kind: "scored", value: "T0" },
    });
    const worst = record({
      dirName: "260101-a-scored-t3",
      tier: { kind: "scored", value: "T3" },
    });
    const absent = record({ dirName: "260101-c-unscored", tier: UNSCORED });

    // These tie on breach, flag, milestone and neglect age, so the dirName
    // tiebreak decides — exactly as before the rung existed. A live rung ranking
    // by tier would have surfaced the T0 record first instead.
    expect(
      [best, absent, worst].toSorted(compare).map((entry) => entry.dirName),
    ).toEqual([
      "260101-a-scored-t3",
      "260101-b-scored-t0",
      "260101-c-unscored",
    ]);
  });

  test("a scored tier does not outrank an unscored one by presence alone", () => {
    const scored = record({
      dirName: "260101-z-scored",
      tier: { kind: "scored", value: "T0" },
    });
    const unscored = record({ dirName: "260101-a-unscored", tier: UNSCORED });
    expect(firstOf(scored, unscored)).toBe("260101-a-unscored");
  });
});
