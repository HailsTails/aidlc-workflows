import { describe, expect, test } from "vitest";
import type { MetaTier, TierValue } from "./rin-gates-importance-binding.ts";
import {
  decideByMetaTier,
  META_TIER_DEPTH,
  type RankedRecord,
  rankMilestone,
  selectionOrderComparator,
} from "./rin-gates-selection-order.ts";

const RATIFIED_MILESTONES = ["M1", "M2", "M3"];

const record = (overrides: Partial<RankedRecord>): RankedRecord => ({
  dirName: "260101-a-record",
  flagged: "not-flagged",
  milestone: { kind: "unbound" },
  tier: { kind: "unscored" },
  gatePosition: 1,
  neglectDays: 1,
  ...overrides,
});

const firstOf = (left: RankedRecord, right: RankedRecord): string =>
  selectionOrderComparator(left, right) < 0 ? left.dirName : right.dirName;

describe("neglect age alone never outranks a flag or a milestone rank", () => {
  test("a long-neglected record loses to a freshly flagged one", () => {
    const aged = record({ dirName: "aged", neglectDays: 365 });
    const flagged = record({ dirName: "flagged", flagged: "operator-flagged" });
    expect(firstOf(aged, flagged)).toBe("flagged");
  });

  test("a long-neglected record loses to a higher-ranked ratified milestone", () => {
    const aged = record({
      dirName: "aged",
      neglectDays: 365,
      milestone: { kind: "ratified", rank: 1 },
    });
    const milestone = record({
      dirName: "milestone",
      milestone: { kind: "ratified", rank: 0 },
    });
    expect(firstOf(aged, milestone)).toBe("milestone");
  });
});

describe("rung 1 — operator-flagged", () => {
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

describe("rung 2 — milestone rank", () => {
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

  test("a ratified record ranks above an unratified one", () => {
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
    expect(firstOf(unratified, ratified)).toBe("b-ratified");
  });

  test("a ratified record ranks above a no-milestone one", () => {
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
    expect(firstOf(none, ratified)).toBe("b-ratified");
  });

  test("a ratified record ranks above an unbound one", () => {
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
    expect(firstOf(unbound, ratified)).toBe("b-ratified");
  });

  test("a ratified record outranks a non-ratified one that is further along and more neglected", () => {
    const furtherAlong = record({
      dirName: "a-no-milestone-implement",
      milestone: { kind: "no-milestone" },
      gatePosition: 4,
      neglectDays: 90,
    });
    const ratified = record({
      dirName: "b-ratified-framing",
      milestone: { kind: "ratified", rank: 2 },
      gatePosition: 1,
      neglectDays: 1,
    });
    expect(firstOf(furtherAlong, ratified)).toBe("b-ratified-framing");
  });

  test("the lowest-ranked ratified milestone still outranks a non-ratified record", () => {
    const unratified = record({
      dirName: "a-unratified",
      milestone: { kind: "unratified" },
      gatePosition: 4,
    });
    const ratified = record({
      dirName: "b-ratified-last",
      milestone: { kind: "ratified", rank: 9 },
      gatePosition: 1,
    });
    expect(firstOf(unratified, ratified)).toBe("b-ratified-last");
  });

  const lastRatified = record({
    dirName: "z-ratified-framing",
    milestone: { kind: "ratified", rank: 9 },
    gatePosition: 1,
    neglectDays: 1,
  });
  const unratifiedImplement = record({
    dirName: "a-unratified-implement",
    milestone: { kind: "unratified" },
    gatePosition: 4,
    neglectDays: 90,
  });
  const noMilestoneImplement = record({
    dirName: "a-no-milestone-implement",
    milestone: { kind: "no-milestone" },
    gatePosition: 4,
    neglectDays: 90,
  });
  const unboundImplement = record({
    dirName: "a-unbound-implement",
    milestone: { kind: "unbound" },
    gatePosition: 4,
    neglectDays: 90,
  });

  test.each([
    ["unratified", "left", lastRatified, unratifiedImplement],
    ["unratified", "right", unratifiedImplement, lastRatified],
    ["no-milestone", "left", lastRatified, noMilestoneImplement],
    ["no-milestone", "right", noMilestoneImplement, lastRatified],
    ["unbound", "left", lastRatified, unboundImplement],
    ["unbound", "right", unboundImplement, lastRatified],
  ])("a ratified record outranks a further-along %s one with the ratified row on the %s", (_kind, _side, left, right) => {
    expect(firstOf(left, right)).toBe("z-ratified-framing");
  });

  const unratifiedFraming = record({
    dirName: "z-unratified-framing",
    milestone: { kind: "unratified" },
    gatePosition: 1,
    neglectDays: 90,
  });
  const noMilestoneFraming = record({
    dirName: "z-no-milestone-framing",
    milestone: { kind: "no-milestone" },
    gatePosition: 1,
    neglectDays: 90,
  });
  const noMilestoneLaterImplement = record({
    dirName: "z-no-milestone-implement",
    milestone: { kind: "no-milestone" },
    gatePosition: 4,
    neglectDays: 1,
  });
  const unratifiedLaterImplement = record({
    dirName: "z-unratified-implement",
    milestone: { kind: "unratified" },
    gatePosition: 4,
    neglectDays: 1,
  });
  const unboundLaterImplement = record({
    dirName: "z-unbound-implement",
    milestone: { kind: "unbound" },
    gatePosition: 4,
    neglectDays: 1,
  });

  test.each([
    ["unratified framing", "no-milestone implement", unratifiedFraming, noMilestoneLaterImplement, "z-no-milestone-implement"],
    ["no-milestone implement", "unratified framing", noMilestoneLaterImplement, unratifiedFraming, "z-no-milestone-implement"],
    ["no-milestone framing", "no-milestone implement", noMilestoneFraming, noMilestoneLaterImplement, "z-no-milestone-implement"],
    ["no-milestone implement", "no-milestone framing", noMilestoneLaterImplement, noMilestoneFraming, "z-no-milestone-implement"],
    ["unratified framing", "unbound implement", unratifiedFraming, unboundLaterImplement, "z-unbound-implement"],
    ["unbound implement", "unratified framing", unboundLaterImplement, unratifiedFraming, "z-unbound-implement"],
    ["no-milestone framing", "unratified implement", noMilestoneFraming, unratifiedLaterImplement, "z-unratified-implement"],
    ["unratified implement", "no-milestone framing", unratifiedLaterImplement, noMilestoneFraming, "z-unratified-implement"],
  ])("two non-ratified rows defer to stage reached: %s against %s", (_leftLabel, _rightLabel, left, right, expected) => {
    expect(firstOf(left, right)).toBe(expected);
  });
});

describe("rung 3 — furthest along first", () => {
  test("a later gate ranks first", () => {
    expect(
      firstOf(
        record({ dirName: "framing", gatePosition: 1 }),
        record({ dirName: "implement", gatePosition: 4 }),
      ),
    ).toBe("implement");
  });

  test("a later gate outranks a longer-neglected earlier one", () => {
    expect(
      firstOf(
        record({ dirName: "old-framing", gatePosition: 1, neglectDays: 90 }),
        record({ dirName: "fresh-implement", gatePosition: 4, neglectDays: 1 }),
      ),
    ).toBe("fresh-implement");
  });

  test("a higher-ranked ratified milestone outranks a later gate", () => {
    expect(
      firstOf(
        record({
          dirName: "implement",
          gatePosition: 4,
          milestone: { kind: "ratified", rank: 1 },
        }),
        record({
          dirName: "milestone-framing",
          gatePosition: 1,
          milestone: { kind: "ratified", rank: 0 },
        }),
      ),
    ).toBe("milestone-framing");
  });

  test("an operator flag outranks a later gate", () => {
    expect(
      firstOf(
        record({ dirName: "implement", gatePosition: 4 }),
        record({
          dirName: "flagged-framing",
          gatePosition: 1,
          flagged: "operator-flagged",
        }),
      ),
    ).toBe("flagged-framing");
  });

  test("the same gate defers to neglect age", () => {
    expect(
      firstOf(
        record({ dirName: "fresh", gatePosition: 2, neglectDays: 2 }),
        record({ dirName: "stale", gatePosition: 2, neglectDays: 20 }),
      ),
    ).toBe("stale");
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
    expect(selectionOrderComparator(left, right)).toBeLessThan(0);
    expect(selectionOrderComparator(right, left)).toBeGreaterThan(0);
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
        .map((right) => selectionOrderComparator(left, right)),
    );
    expect(pairs.every((verdict) => verdict !== 0)).toBe(true);
  });
});

describe("order independence (FR-3)", () => {
  test("two shuffled enumerations of the same set produce identical output", () => {
    const records = [
      record({ dirName: "260101-alpha", neglectDays: 3 }),
      record({ dirName: "260102-beta", flagged: "operator-flagged" }),
      record({ dirName: "260103-gamma", gatePosition: 4, neglectDays: 32 }),
      record({ dirName: "260104-delta", neglectDays: 3 }),
    ];
    const forward = [...records].sort(selectionOrderComparator).map((r) => r.dirName);
    const reversed = [...records]
      .reverse()
      .sort(selectionOrderComparator)
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
        record({ dirName: "aged", neglectDays: 130 }),
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
        ratifiedMilestones: RATIFIED_MILESTONES,
      }),
    ).toEqual({ kind: "ratified", rank: 1 });
  });

  test("an identifier absent from the ratified list is unratified", () => {
    expect(
      rankMilestone({
        milestone: { kind: "milestone", identifier: "M9" },
        ratifiedMilestones: RATIFIED_MILESTONES,
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
        ratifiedMilestones: RATIFIED_MILESTONES,
      }),
    ).toEqual({ kind: "no-milestone" });
  });

  test("an unbound record resolves to unbound", () => {
    expect(
      rankMilestone({
        milestone: "unbound",
        ratifiedMilestones: RATIFIED_MILESTONES,
      }),
    ).toEqual({ kind: "unbound" });
  });
});

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

    expect(
      [best, absent, worst].toSorted(selectionOrderComparator).map((entry) => entry.dirName),
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
