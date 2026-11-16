import { describe, expect, test } from "vitest";
import {
  gatePairMeasureOf,
  parseReview,
  reviewFileLocationOf,
  reviewRoundsMeasureOf,
} from "./review-rounds.ts";

const GATE_DIR =
  "aidlc/spaces/default/intents/260101-sample/inception/rin-gate-1-framing";

const SECOND_ROUND = [
  "**Verdict:** NOT-READY",
  "",
  "| ID | Finding | Status |",
  "| --- | --- | --- |",
  "| R-01 | the window has no timezone | Resolved |",
  "| R-02 | the runtime has no deadline | Unresolved |",
  "| R-03 | the fix names a slot nobody owns | New |",
].join("\n");

const THIRD_ROUND_WITHOUT_STATUS = [
  "**Verdict: READY**",
  "",
  "| # | Finding |",
  "| --- | --- |",
  "| R-03 | the fix names a slot nobody owns |",
  "| R-04 | a figure has no facts row |",
].join("\n");

describe("a review file's path names its record, gate and round", () => {
  test("reads a plain review file", () => {
    expect(
      reviewFileLocationOf({ path: `${GATE_DIR}/reviews/review-02.md` }),
    ).toMatchObject({
      record: "260101-sample",
      gate: "rin-gate-1-framing",
      round: 2,
    });
  });

  test("reads the gate-prefixed spelling", () => {
    expect(
      reviewFileLocationOf({ path: `${GATE_DIR}/reviews/gate1-review-03.md` }),
    ).toMatchObject({ round: 3 });
  });

  test("ignores a file under reviews that is not a round", () => {
    expect(
      reviewFileLocationOf({ path: `${GATE_DIR}/reviews/notes.md` }),
    ).toBeNull();
  });
});

describe("a review file yields its verdict and its finding rows", () => {
  test("reads the verdict and every finding id", () => {
    expect(parseReview({ text: SECOND_ROUND })).toEqual({
      verdict: "NOT-READY",
      findingIds: ["R-01", "R-02", "R-03"],
      findingIdsMarkedNew: ["R-03"],
      tracksStatus: true,
    });
  });

  test("reads a bolded READY verdict and a table with no status column", () => {
    expect(parseReview({ text: THIRD_ROUND_WITHOUT_STATUS })).toMatchObject({
      verdict: "READY",
      findingIds: ["R-03", "R-04"],
      tracksStatus: false,
    });
  });

  test("a file with no verdict line is unknown, with no findings", () => {
    expect(parseReview({ text: "No table here." })).toMatchObject({
      verdict: "UNKNOWN",
      findingIds: [],
    });
  });
});

describe("findings are counted in the round that first raised them", () => {
  test("rounds are ordered and a carried row is not counted again", () => {
    expect(
      gatePairMeasureOf({
        record: "260101-sample",
        gate: "rin-gate-1-framing",
        rounds: [
          {
            round: 3,
            verdict: "READY",
            findingIds: ["R-03", "R-04"],
            findingIdsMarkedNew: [],
            tracksStatus: false,
          },
          {
            round: 1,
            verdict: "NOT-READY",
            findingIds: ["R-01", "R-02"],
            findingIdsMarkedNew: ["R-01", "R-02"],
            tracksStatus: true,
          },
          {
            round: 2,
            verdict: "NOT-READY",
            findingIds: ["R-01", "R-02", "R-03"],
            findingIdsMarkedNew: ["R-03"],
            tracksStatus: true,
          },
        ],
      }),
    ).toEqual({
      record: "260101-sample",
      gate: "rin-gate-1-framing",
      rounds: 3,
      verdicts: ["NOT-READY", "NOT-READY", "READY"],
      firstRaisedPerRound: [2, 1, 1],
    });
  });

  test("the share is the findings first raised after round 1 over all first raisings", () => {
    expect(
      reviewRoundsMeasureOf({
        pairs: [
          {
            record: "260101-sample",
            gate: "rin-gate-1-framing",
            rounds: 3,
            verdicts: ["NOT-READY", "NOT-READY", "READY"],
            firstRaisedPerRound: [2, 1, 1],
          },
        ],
      }),
    ).toMatchObject({
      pairCount: 1,
      meanRoundsPerPair: 3,
      pairsOverTwoRounds: 1,
      findingsFirstRaised: 4,
      findingsFirstRaisedAfterRoundOne: 2,
      shareFirstRaisedAfterRoundOne: 0.5,
    });
  });

  test("no pairs measure as zero, not as a division by zero", () => {
    expect(reviewRoundsMeasureOf({ pairs: [] })).toMatchObject({
      meanRoundsPerPair: 0,
      shareFirstRaisedAfterRoundOne: 0,
    });
  });
});
