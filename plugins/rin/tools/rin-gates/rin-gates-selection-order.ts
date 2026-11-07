import type { MetaTier } from "./rin-gates-importance-binding.ts";

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
  readonly gatePosition: number;
  readonly neglectDays: number;
};

type SelectionOrderComparator = (
  left: RankedRecord,
  right: RankedRecord,
) => number;

const LEFT_FIRST = -1;
const RIGHT_FIRST = 1;
const DEFER = 0;

const decideByOperatorFlag = (args: {
  readonly left: RankedRecord;
  readonly right: RankedRecord;
}): number => {
  const leftFlagged = args.left.flagged === "operator-flagged";
  const rightFlagged = args.right.flagged === "operator-flagged";
  if (leftFlagged === rightFlagged) return DEFER;
  return leftFlagged ? LEFT_FIRST : RIGHT_FIRST;
};

const decideRatifiedAgainst = (args: {
  readonly rank: number;
  readonly other: RankedMilestone;
}): number => {
  switch (args.other.kind) {
    case "ratified":
      if (args.rank === args.other.rank) return DEFER;
      return args.rank < args.other.rank ? LEFT_FIRST : RIGHT_FIRST;
    case "unratified":
    case "no-milestone":
    case "unbound":
      return LEFT_FIRST;
  }
};

const decideNonRatifiedAgainst = (args: {
  readonly other: RankedMilestone;
}): number => {
  switch (args.other.kind) {
    case "ratified":
      return RIGHT_FIRST;
    case "unratified":
    case "no-milestone":
    case "unbound":
      return DEFER;
  }
};

const decideByMilestoneRank = (args: {
  readonly left: RankedMilestone;
  readonly right: RankedMilestone;
}): number => {
  switch (args.left.kind) {
    case "ratified":
      return decideRatifiedAgainst({ rank: args.left.rank, other: args.right });
    case "unratified":
    case "no-milestone":
    case "unbound":
      return decideNonRatifiedAgainst({ other: args.right });
  }
};

const decideByGatePosition = (args: {
  readonly left: RankedRecord;
  readonly right: RankedRecord;
}): number => {
  if (args.left.gatePosition === args.right.gatePosition) return DEFER;
  return args.left.gatePosition > args.right.gatePosition
    ? LEFT_FIRST
    : RIGHT_FIRST;
};

type MetaTierDepth = { readonly kind: "unanswered" };

const META_TIER_DEPTH: MetaTierDepth = { kind: "unanswered" };

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

const selectionOrderComparator: SelectionOrderComparator = (left, right) => {
  const byOperatorFlag = decideByOperatorFlag({ left, right });
  if (byOperatorFlag !== DEFER) return byOperatorFlag;

  const byMilestone = decideByMilestoneRank({
    left: left.milestone,
    right: right.milestone,
  });
  if (byMilestone !== DEFER) return byMilestone;

  const byGatePosition = decideByGatePosition({ left, right });
  if (byGatePosition !== DEFER) return byGatePosition;

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
