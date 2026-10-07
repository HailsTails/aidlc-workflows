import type { MetaTier } from "./rin-gates-importance-binding.ts";
import type { SelectionConfig } from "./rin-gates-selection-config.ts";

type RankedMilestone =
  | { readonly kind: "ratified"; readonly rank: number }
  | { readonly kind: "unratified" }
  | { readonly kind: "no-milestone" }
  | { readonly kind: "unbound" };

type RankedFlag =
  | "operator-flagged"
  | "lane-flagged"
  | "not-flagged"
  | "unbound";

type RankedRecord = {
  readonly dirName: string;
  readonly flagged: RankedFlag;
  readonly milestone: RankedMilestone;
  readonly tier: MetaTier;
  readonly neglectDays: number;
};

type SelectionOrderComparator = (
  left: RankedRecord,
  right: RankedRecord,
) => number;

const LEFT_FIRST = -1;
const RIGHT_FIRST = 1;
const DEFER = 0;

const decideByBreach = (args: {
  readonly left: RankedRecord;
  readonly right: RankedRecord;
  readonly thresholdDays: number;
}): number => {
  const leftBreaches = args.left.neglectDays >= args.thresholdDays;
  const rightBreaches = args.right.neglectDays >= args.thresholdDays;
  if (leftBreaches === rightBreaches) return DEFER;
  return leftBreaches ? LEFT_FIRST : RIGHT_FIRST;
};

const decideByOperatorFlag = (args: {
  readonly left: RankedRecord;
  readonly right: RankedRecord;
}): number => {
  const leftFlagged = args.left.flagged === "operator-flagged";
  const rightFlagged = args.right.flagged === "operator-flagged";
  if (leftFlagged === rightFlagged) return DEFER;
  return leftFlagged ? LEFT_FIRST : RIGHT_FIRST;
};

const decideByMilestoneRank = (args: {
  readonly left: RankedMilestone;
  readonly right: RankedMilestone;
}): number => {
  if (args.left.kind !== "ratified" || args.right.kind !== "ratified") {
    return DEFER;
  }
  if (args.left.rank === args.right.rank) return DEFER;
  return args.left.rank < args.right.rank ? LEFT_FIRST : RIGHT_FIRST;
};

// Gap `G3-C6` as a closed union rather than a comment: where the tier rung sits
// relative to milestone rank is reserved to the goal owner, so the unanswered
// state is a member the comparator must handle rather than an absence it can
// forget. Answering the Gap adds a member here, and CD-8's exhaustive switch
// then makes handling it a compile-time obligation at every rung site. That
// amendment travels the lock-amendment ceremony, never implementation fiat.
type MetaTierDepth = { readonly kind: "unanswered" };

const META_TIER_DEPTH: MetaTierDepth = { kind: "unanswered" };

// IF-11 — the meta-tier rung, locked in SHAPE and DEFERRING in DEPTH. It is
// wired into the comparator and executes on every comparison, so its path is
// never dark; until the Gap is answered it returns DEFER for every pair and the
// emitted order stays byte-identical to the pre-change order.
const decideByMetaTier = (args: {
  readonly left: MetaTier;
  readonly right: MetaTier;
  readonly depth: MetaTierDepth;
}): number => {
  switch (args.depth.kind) {
    case "unanswered":
      return DEFER;
  }
};

const decideByNeglectAge = (args: {
  readonly left: RankedRecord;
  readonly right: RankedRecord;
}): number => {
  if (args.left.neglectDays === args.right.neglectDays) return DEFER;
  return args.left.neglectDays > args.right.neglectDays
    ? LEFT_FIRST
    : RIGHT_FIRST;
};

const selectionOrderComparator = (args: {
  readonly config: SelectionConfig;
}): SelectionOrderComparator => {
  const thresholdDays = args.config.neglectThresholdDays;
  return (left, right) => {
    const byBreach = decideByBreach({ left, right, thresholdDays });
    if (byBreach !== DEFER) return byBreach;

    const byOperatorFlag = decideByOperatorFlag({ left, right });
    if (byOperatorFlag !== DEFER) return byOperatorFlag;

    const byMilestone = decideByMilestoneRank({
      left: left.milestone,
      right: right.milestone,
    });
    if (byMilestone !== DEFER) return byMilestone;

    const byMetaTier = decideByMetaTier({
      left: left.tier,
      right: right.tier,
      depth: META_TIER_DEPTH,
    });
    if (byMetaTier !== DEFER) return byMetaTier;

    const byNeglect = decideByNeglectAge({ left, right });
    if (byNeglect !== DEFER) return byNeglect;

    return left.dirName.localeCompare(right.dirName);
  };
};

const rankMilestone = (args: {
  readonly milestone:
    | { readonly kind: "milestone"; readonly identifier: string }
    | { readonly kind: "no-milestone" }
    | "unbound";
  readonly ratifiedMilestones: readonly string[];
}): RankedMilestone => {
  if (args.milestone === "unbound") return { kind: "unbound" };
  if (args.milestone.kind === "no-milestone") return { kind: "no-milestone" };
  const rank = args.ratifiedMilestones.indexOf(args.milestone.identifier);
  return rank === -1 ? { kind: "unratified" } : { kind: "ratified", rank };
};

export {
  decideByMetaTier,
  META_TIER_DEPTH,
  type MetaTierDepth,
  type RankedFlag,
  type RankedMilestone,
  type RankedRecord,
  rankMilestone,
  type SelectionOrderComparator,
  selectionOrderComparator,
};
