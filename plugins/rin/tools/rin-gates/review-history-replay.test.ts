import { describe, expect, test } from "vitest";
import type { CloseReceipt } from "./rin-gates-bounded-close.ts";
import {
  boardHandBacksOf,
  closingHandBacksOf,
  type GateVerdict,
  type ReviewHistory,
  replayOutcomeOf,
  replayReviewHistory,
  reviewHistoryOf,
} from "./review-history-replay.ts";

const STAGE_LENS = "rin-stage-reviewer-agent";
const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const BOARD_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FIX_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NEXT_GATE = "rin-gate-2-plan-review";

const HISTORY: ReviewHistory = {
  record: "260101-sample",
  gate: "rin-gate-1-framing",
  roster: [STAGE_LENS, SYNTHESIS_LENS],
  rounds: [
    { ordinal: 1, headSha: BOARD_HEAD },
    { ordinal: 2, headSha: FIX_HEAD },
  ],
  rows: [
    {
      id: "R-01",
      raisedRound: 1,
      lens: STAGE_LENS,
      text: "the window has no timezone",
      closedByCommit: FIX_HEAD,
    },
    {
      id: "R-02",
      raisedRound: 1,
      lens: STAGE_LENS,
      text: "the runtime | has no deadline",
      closedByCommit: null,
    },
    {
      id: "R-03",
      raisedRound: 2,
      lens: STAGE_LENS,
      text: "the fix names a slot nobody owns",
      closedByCommit: null,
    },
    {
      id: "R-04",
      raisedRound: 3,
      lens: STAGE_LENS,
      text: "a figure has no facts row",
      closedByCommit: null,
    },
  ],
};

const OPEN_ROW_LINES: readonly string[] = [
  "G1-R01 | R-01 the window has no timezone",
  "G1-R02 | R-02 the runtime / has no deadline",
];

const STANDING_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: "rin-gate-1-framing",
  record: "260101-sample",
  attempt: 1,
  validity: { kind: "standing" },
  closedBy: "closing-ruling",
  boardHeadSha: BOARD_HEAD,
  closedHeadSha: FIX_HEAD,
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [
    {
      id: "G1-R01",
      lens: STAGE_LENS,
      text: "R-01 the window has no timezone",
      origin: { kind: "raised" },
      outcome: { kind: "fixed", commitSha: FIX_HEAD },
      note: "",
    },
    {
      id: "G1-R02",
      lens: STAGE_LENS,
      text: "R-02 the runtime / has no deadline",
      origin: { kind: "raised" },
      outcome: { kind: "forwarded", toGate: NEXT_GATE },
      note: "",
    },
  ],
  rechecks: [],
  unadmitted: [
    {
      lens: STAGE_LENS,
      headSha: FIX_HEAD,
      text: "R-03 the fix names a slot nobody owns",
    },
  ],
  emittedBy: "rin-gates-review-scribe",
};

const INVALIDATED_RECEIPT: CloseReceipt = {
  ...STANDING_RECEIPT,
  validity: {
    kind: "invalidated",
    reason: { kind: "reviewer-dispatch", agentType: STAGE_LENS },
    at: "2026-01-01T00:00:00.000Z",
  },
};

const READY_VERDICT: GateVerdict = {
  verdict: "READY",
  headSha: FIX_HEAD,
  findings: OPEN_ROW_LINES,
  blockingFindings: [],
  lenses: [STAGE_LENS, SYNTHESIS_LENS],
  isClosedByReceipt: true,
};

const NOT_READY_VERDICT: GateVerdict = {
  verdict: "NOT-READY",
  headSha: FIX_HEAD,
  findings: OPEN_ROW_LINES,
  blockingFindings: OPEN_ROW_LINES,
  lenses: [STAGE_LENS, SYNTHESIS_LENS],
  isClosedByReceipt: false,
};

describe("a recorded history decodes or is refused", () => {
  test("reads the fields the replay uses", () => {
    expect(
      reviewHistoryOf({
        text: '{"record":"260101-sample","gate":"rin-gate-1-framing","roster":["rin-stage-reviewer-agent"],"rounds":[{"ordinal":1,"headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","aggregate":"NOT-READY"}],"rows":[]}',
      }),
    ).toEqual({
      record: "260101-sample",
      gate: "rin-gate-1-framing",
      roster: ["rin-stage-reviewer-agent"],
      rounds: [
        { ordinal: 1, headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      ],
      rows: [],
    });
  });

  test("a history with no rounds field is refused", () => {
    expect(() =>
      reviewHistoryOf({ text: '{"record":"260101-sample"}' }),
    ).toThrow();
  });
});

describe("the one full board reports what the first recorded round raised", () => {
  test("each roster lens reports once at the board head, the synthesis lens last", () => {
    expect(boardHandBacksOf({ history: HISTORY })).toEqual([
      {
        lens: "rin-stage-reviewer-agent",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        message:
          "## Verdict\n\nNOT-READY\n\n- R-01 the window has no timezone | rin-stage-reviewer-agent | first raised in round 1\n- R-02 the runtime / has no deadline | rin-stage-reviewer-agent | first raised in round 1\n",
      },
      {
        lens: "rin-intent-defense-reviewer-agent",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        message:
          "## Verdict\n\nREADY — reviewed at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\n\n\n",
      },
    ]);
  });
});

describe("the bounded close rechecks by row, then rules once", () => {
  test("a raising lens rechecks its own rows and offers what the next round raised; the ruling fixes or forwards each board row", () => {
    expect(
      closingHandBacksOf({
        history: HISTORY,
        openRowLines: OPEN_ROW_LINES,
        forwardGate: NEXT_GATE,
      }),
    ).toEqual([
      {
        lens: "rin-stage-reviewer-agent",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        message:
          "## Verdict\n\nNOT-READY\n\n- G1-R01 | resolved | rechecked at bbbbbbbbb\n- G1-R02 | still open | rechecked at bbbbbbbbb\n- R-03 the fix names a slot nobody owns | rin-stage-reviewer-agent | first raised in round 2\n",
      },
      {
        lens: "rin-intent-defense-reviewer-agent",
        headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        message:
          "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- G1-R01 | fixed@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | R-01, by the recorded history's next board\n- G1-R02 | forwarded(rin-gate-2-plan-review) | R-02, by the recorded history's next board\n",
      },
    ]);
  });

  test("where the gate named no rows, the history's own ids stand in", () => {
    expect(
      closingHandBacksOf({
        history: HISTORY,
        openRowLines: [],
        forwardGate: NEXT_GATE,
      })[1],
    ).toEqual({
      lens: "rin-intent-defense-reviewer-agent",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      message:
        "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- R-01 | fixed@bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb | R-01, by the recorded history's next board\n- R-02 | forwarded(rin-gate-2-plan-review) | R-02, by the recorded history's next board\n",
    });
  });
});

describe("a closing receipt reads back as outcomes on the recorded findings", () => {
  test("each recorded finding lands in exactly one list", () => {
    expect(
      replayOutcomeOf({ history: HISTORY, receipt: STANDING_RECEIPT }),
    ).toEqual({
      fixed: ["R-01"],
      rejected: [],
      forwarded: ["R-02"],
      notAdmitted: ["R-03"],
      neverRaisedAtThisGate: ["R-04"],
    });
  });
});

describe("a replay hands the board back, then the close, and reports how the gate ended", () => {
  test("a standing receipt under a READY verdict is a closed gate", async () => {
    const lensesHandedBack: string[] = [];
    const result = await replayReviewHistory({
      history: HISTORY,
      forwardGate: NEXT_GATE,
      gate: {
        handBack: async (handBack) => {
          lensesHandedBack.push(handBack.lens);
          return "";
        },
        verdict: () => READY_VERDICT,
        receipt: () => STANDING_RECEIPT,
      },
    });
    expect(result).toEqual({
      kind: "closed",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      closedBy: "closing-ruling",
      lensReports: 4,
      outcome: {
        fixed: ["R-01"],
        rejected: [],
        forwarded: ["R-02"],
        notAdmitted: ["R-03"],
        neverRaisedAtThisGate: ["R-04"],
      },
    });
    expect(lensesHandedBack).toEqual([
      "rin-stage-reviewer-agent",
      "rin-intent-defense-reviewer-agent",
      "rin-stage-reviewer-agent",
      "rin-intent-defense-reviewer-agent",
    ]);
  });

  test("no receipt leaves the gate open at the verdict it has", async () => {
    expect(
      await replayReviewHistory({
        history: HISTORY,
        forwardGate: NEXT_GATE,
        gate: {
          handBack: async () => "",
          verdict: () => NOT_READY_VERDICT,
          receipt: () => null,
        },
      }),
    ).toEqual({
      kind: "left-open",
      verdict: "NOT-READY",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lensReports: 4,
    });
  });

  test("an invalidated receipt leaves the gate open", async () => {
    expect(
      await replayReviewHistory({
        history: HISTORY,
        forwardGate: NEXT_GATE,
        gate: {
          handBack: async () => "",
          verdict: () => READY_VERDICT,
          receipt: () => INVALIDATED_RECEIPT,
        },
      }),
    ).toEqual({
      kind: "left-open",
      verdict: "READY",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lensReports: 4,
    });
  });

  test("a standing receipt under a NOT-READY verdict leaves the gate open", async () => {
    expect(
      await replayReviewHistory({
        history: HISTORY,
        forwardGate: NEXT_GATE,
        gate: {
          handBack: async () => "",
          verdict: () => NOT_READY_VERDICT,
          receipt: () => STANDING_RECEIPT,
        },
      }),
    ).toEqual({
      kind: "left-open",
      verdict: "NOT-READY",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lensReports: 4,
    });
  });
});
