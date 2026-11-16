type ReviewVerdict = "READY" | "NOT-READY" | "UNKNOWN";

type ReviewFileLocation = {
  readonly path: string;
  readonly record: string;
  readonly gate: string;
  readonly round: number;
};

type ParsedReview = {
  readonly verdict: ReviewVerdict;
  readonly findingIds: readonly string[];
  readonly findingIdsMarkedNew: readonly string[];
  readonly tracksStatus: boolean;
};

type ReviewRound = ParsedReview & { readonly round: number };

type GatePairMeasure = {
  readonly record: string;
  readonly gate: string;
  readonly rounds: number;
  readonly verdicts: readonly ReviewVerdict[];
  readonly firstRaisedPerRound: readonly number[];
};

type ReviewRoundsMeasure = {
  readonly pairs: readonly GatePairMeasure[];
  readonly pairCount: number;
  readonly meanRoundsPerPair: number;
  readonly pairsOverTwoRounds: number;
  readonly findingsFirstRaised: number;
  readonly findingsFirstRaisedAfterRoundOne: number;
  readonly shareFirstRaisedAfterRoundOne: number;
};

const REVIEW_FILE_PATH =
  /^aidlc\/spaces\/default\/intents\/([^/]+)\/(?:inception|construction|operation)\/(rin-gate-\d-[a-z-]+)\/reviews\/(?:review-(\d+)|gate\d-review-(\d+))\.md$/;
const VERDICT_LINE = /^\*\*Verdict:?\*?\*?:?\*?\*?\s*(.*)$/im;
const FINDINGS_TABLE_HEADER = /^\|\s*(?:ID|#)\s*\|/i;
const TABLE_SEPARATOR_ROW = /^\|\s*-+/;
const EMPTY_FINDING_ID = /^(?:-+|none|—|n\/a)$/i;
const NEW_STATUS = /\bnew\b/i;
const NOT_READY_WORDING = /^\s*NOT[- ]READY/;
const READY_WORDING = /^\s*READY/;
const REVISION_WORDING = /REQUEST_CHANGES|REVISE|ITERATE/;

const reviewFileLocationOf = ({
  path,
}: {
  readonly path: string;
}): ReviewFileLocation | null => {
  const match = REVIEW_FILE_PATH.exec(path);
  if (match === null) return null;
  const [, record, gate, plainRound, gatePrefixedRound] = match;
  if (record === undefined || gate === undefined) return null;
  return {
    path,
    record,
    gate,
    round: Number(plainRound ?? gatePrefixedRound),
  };
};

const verdictOf = ({ text }: { readonly text: string }): ReviewVerdict => {
  const wording = (VERDICT_LINE.exec(text)?.[1] ?? "")
    .replace(/\*/g, "")
    .toUpperCase();
  if (NOT_READY_WORDING.test(wording)) return "NOT-READY";
  if (READY_WORDING.test(wording)) return "READY";
  return REVISION_WORDING.test(wording) ? "NOT-READY" : "UNKNOWN";
};

const cellsOf = ({ row }: { readonly row: string }): readonly string[] =>
  row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

type TableScan = {
  readonly statusColumn: number | null;
  readonly inTable: boolean;
  readonly findingIds: readonly string[];
  readonly findingIdsMarkedNew: readonly string[];
  readonly tracksStatus: boolean;
};

const OUTSIDE_ANY_TABLE: TableScan = {
  statusColumn: null,
  inTable: false,
  findingIds: [],
  findingIdsMarkedNew: [],
  tracksStatus: false,
};

const scanLine = (scan: TableScan, line: string): TableScan => {
  if (FINDINGS_TABLE_HEADER.test(line)) {
    const statusIndex = cellsOf({ row: line }).findIndex(
      (heading) => heading.toLowerCase() === "status",
    );
    return {
      ...scan,
      inTable: true,
      statusColumn: statusIndex >= 0 ? statusIndex : null,
      tracksStatus: scan.tracksStatus || statusIndex >= 0,
    };
  }
  if (!scan.inTable) return scan;
  if (!line.startsWith("|")) return { ...scan, inTable: false };
  if (TABLE_SEPARATOR_ROW.test(line)) return scan;
  const cells = cellsOf({ row: line });
  const findingId = cells[0] ?? "";
  if (findingId === "" || EMPTY_FINDING_ID.test(findingId)) return scan;
  const markedNew =
    scan.statusColumn !== null &&
    NEW_STATUS.test(cells[scan.statusColumn] ?? "");
  return {
    ...scan,
    findingIds: [...scan.findingIds, findingId],
    findingIdsMarkedNew: markedNew
      ? [...scan.findingIdsMarkedNew, findingId]
      : scan.findingIdsMarkedNew,
  };
};

const parseReview = ({ text }: { readonly text: string }): ParsedReview => {
  const scan = text.split("\n").reduce(scanLine, OUTSIDE_ANY_TABLE);
  return {
    verdict: verdictOf({ text }),
    findingIds: scan.findingIds,
    findingIdsMarkedNew: scan.findingIdsMarkedNew,
    tracksStatus: scan.tracksStatus,
  };
};

type RaisedSoFar = {
  readonly seenIds: ReadonlySet<string>;
  readonly firstRaisedPerRound: readonly number[];
};

const NOTHING_RAISED_YET: RaisedSoFar = {
  seenIds: new Set<string>(),
  firstRaisedPerRound: [],
};

const firstRaisedIn = ({
  round,
  raised,
}: {
  readonly round: ReviewRound;
  readonly raised: RaisedSoFar;
}): readonly string[] => {
  if (raised.firstRaisedPerRound.length === 0) return round.findingIds;
  if (round.tracksStatus) return round.findingIdsMarkedNew;
  return round.findingIds.filter((id) => !raised.seenIds.has(id));
};

const firstRaisedPerRoundOf = ({
  rounds,
}: {
  readonly rounds: readonly ReviewRound[];
}): readonly number[] =>
  rounds.reduce<RaisedSoFar>(
    (raised, round) => ({
      seenIds: new Set([...raised.seenIds, ...round.findingIds]),
      firstRaisedPerRound: [
        ...raised.firstRaisedPerRound,
        firstRaisedIn({ round, raised }).length,
      ],
    }),
    NOTHING_RAISED_YET,
  ).firstRaisedPerRound;

const gatePairMeasureOf = ({
  record,
  gate,
  rounds,
}: {
  readonly record: string;
  readonly gate: string;
  readonly rounds: readonly ReviewRound[];
}): GatePairMeasure => {
  const ordered = [...rounds].sort((left, right) => left.round - right.round);
  return {
    record,
    gate,
    rounds: ordered.length,
    verdicts: ordered.map((round) => round.verdict),
    firstRaisedPerRound: firstRaisedPerRoundOf({ rounds: ordered }),
  };
};

const sumOf = (counts: readonly number[]): number =>
  counts.reduce((total, count) => total + count, 0);

const reviewRoundsMeasureOf = ({
  pairs,
}: {
  readonly pairs: readonly GatePairMeasure[];
}): ReviewRoundsMeasure => {
  const findingsFirstRaised = sumOf(
    pairs.flatMap((pair) => pair.firstRaisedPerRound),
  );
  const findingsFirstRaisedAfterRoundOne = sumOf(
    pairs.flatMap((pair) => pair.firstRaisedPerRound.slice(1)),
  );
  return {
    pairs,
    pairCount: pairs.length,
    meanRoundsPerPair:
      pairs.length === 0
        ? 0
        : sumOf(pairs.map((pair) => pair.rounds)) / pairs.length,
    pairsOverTwoRounds: pairs.filter((pair) => pair.rounds > 2).length,
    findingsFirstRaised,
    findingsFirstRaisedAfterRoundOne,
    shareFirstRaisedAfterRoundOne:
      findingsFirstRaised === 0
        ? 0
        : findingsFirstRaisedAfterRoundOne / findingsFirstRaised,
  };
};

const PERCENT_PER_WHOLE = 100;

const percentOf = (share: number): string =>
  `${(share * PERCENT_PER_WHOLE).toFixed(1)}%`;

const renderReviewRoundsMeasure = ({
  measure,
  refs,
}: {
  readonly measure: ReviewRoundsMeasure;
  readonly refs: readonly string[];
}): string =>
  [
    `Review rounds per record and gate, read from ${refs.join(", ")}`,
    "",
    "| Record | Gate | Rounds | Verdicts | Findings first raised, per round |",
    "| --- | --- | --- | --- | --- |",
    ...measure.pairs.map(
      (pair) =>
        `| ${pair.record} | ${pair.gate} | ${pair.rounds} | ${pair.verdicts.join(" ")} | ${pair.firstRaisedPerRound.join(" ")} |`,
    ),
    "",
    `Pairs: ${measure.pairCount}`,
    `Mean rounds per pair: ${measure.meanRoundsPerPair.toFixed(2)}`,
    `Pairs that took more than two rounds: ${measure.pairsOverTwoRounds}`,
    `Findings first raised after round 1: ${measure.findingsFirstRaisedAfterRoundOne} of ${measure.findingsFirstRaised} (${percentOf(measure.shareFirstRaisedAfterRoundOne)})`,
  ].join("\n");

export {
  type GatePairMeasure,
  gatePairMeasureOf,
  type ParsedReview,
  parseReview,
  type ReviewFileLocation,
  type ReviewRound,
  type ReviewRoundsMeasure,
  renderReviewRoundsMeasure,
  reviewFileLocationOf,
  reviewRoundsMeasureOf,
};
