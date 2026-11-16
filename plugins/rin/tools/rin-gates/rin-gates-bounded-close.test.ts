import { describe, expect, test } from "vitest";
import {
  type AttemptLedgerEntry,
  attemptStateOf,
  type BoundedClosePolicy,
  type CloseReceipt,
  type CloseReceiptCheck,
  closeReceiptRefusalOf,
  describeInvalidation,
  describeRulingProblem,
  inboundRowsOf,
  laterBoardGatesOf,
  type LensReportCapture,
  type ReviewRow,
  type RuledRow,
  ruledRowLineOf,
  stepAttempt,
} from "./rin-gates-bounded-close.ts";
import { blockingFindingsWithPolicy } from "./rin-gates-finding-disposition.ts";

const FRAMING = "rin-gate-1-framing";
const OPTIONS = "rin-gate-2-plan-review";
const DESIGN = "rin-gate-3-interface-lock";
const BOARD_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CLOSED_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const STAGE_LENS = "rin-stage-reviewer-agent";
const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const REQUIREMENTS =
  "aidlc/spaces/default/intents/260101-close/inception/rin-gate-1-framing/rin-requirements.md";
const AUDIT_SHARD =
  "aidlc/spaces/default/intents/260101-close/audit/clone-1.md";

const POLICY: BoundedClosePolicy = {
  gate: FRAMING,
  roster: [STAGE_LENS, SYNTHESIS_LENS],
  inboundRows: [],
  forwardableGates: [OPTIONS, DESIGN],
  exceptionWhyChainsEnabled: true,
};

const report = ({
  lens,
  verdict,
  findings,
  headSha,
}: Pick<
  LensReportCapture,
  "lens" | "verdict" | "findings" | "headSha"
>): AttemptLedgerEntry => ({
  kind: "report",
  capture: {
    lens,
    verdict,
    findings,
    headSha,
    at: "2026-01-01T00:00:00.000Z",
    sessionId: "session",
    agentId: null,
    channel: null,
    reportText: null,
  },
});

const STAGE_RAISES_AT_THE_BOARD = report({
  lens: STAGE_LENS,
  verdict: "NOT-READY",
  findings: ["a.md:1 | the quote | DD-1 | the defect"],
  headSha: BOARD_HEAD,
});

const SYNTHESIS_READY_AT_THE_BOARD = report({
  lens: SYNTHESIS_LENS,
  verdict: "READY",
  findings: [],
  headSha: BOARD_HEAD,
});

const BOARD_WITH_ONE_FINDING: readonly AttemptLedgerEntry[] = [
  STAGE_RAISES_AT_THE_BOARD,
  SYNTHESIS_READY_AT_THE_BOARD,
];

const FORWARDED_ROW: ReviewRow = {
  id: "G1-R01",
  lens: STAGE_LENS,
  text: "a.md:1 | the quote | DD-1 | the defect",
  origin: { kind: "forwarded", fromGate: FRAMING },
};

const FORWARDED_RULED_ROW: RuledRow = {
  id: "G1-R01",
  lens: STAGE_LENS,
  text: "a.md:1 | the quote | DD-1 | the defect",
  origin: { kind: "raised" },
  outcome: { kind: "forwarded", toGate: OPTIONS },
  note: "",
};

const STANDING_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: FRAMING,
  record: "260101-close",
  attempt: 1,
  validity: { kind: "standing" },
  closedBy: "closing-ruling",
  boardHeadSha: BOARD_HEAD,
  closedHeadSha: CLOSED_HEAD,
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [FORWARDED_RULED_ROW],
  rechecks: [],
  unadmitted: [],
  emittedBy: "rin-gates-review-scribe",
};

const HOLDING_CHECK: CloseReceiptCheck = {
  gate: FRAMING,
  receipt: STANDING_RECEIPT,
  verdictHeadSha: CLOSED_HEAD,
  verdictNamesReceipt: true,
  inboundRows: [],
  changedPathsSinceClose: [],
  reviewedArtifactPaths: [REQUIREMENTS],
};

describe("the attempt ledger folds to one state per gate", () => {
  test("a board that is not yet covered is still boarding", () => {
    expect(
      attemptStateOf({
        entries: [STAGE_RAISES_AT_THE_BOARD],
        policy: POLICY,
      }).phase,
    ).toBe("boarding");
  });

  test("a covered board with a finding opens one row and waits for the ruling", () => {
    expect(
      attemptStateOf({ entries: BOARD_WITH_ONE_FINDING, policy: POLICY }),
    ).toMatchObject({
      phase: "closing",
      rows: [
        {
          id: "G1-R01",
          lens: "rin-stage-reviewer-agent",
          text: "a.md:1 | the quote | DD-1 | the defect",
          origin: { kind: "raised" },
        },
      ],
    });
  });

  test("a NOT-READY that cites nothing still opens a row", () => {
    expect(
      attemptStateOf({
        entries: [
          report({
            lens: STAGE_LENS,
            verdict: "NOT-READY",
            findings: [],
            headSha: BOARD_HEAD,
          }),
          SYNTHESIS_READY_AT_THE_BOARD,
        ],
        policy: POLICY,
      }),
    ).toMatchObject({
      phase: "closing",
      rows: [
        {
          text: "rin-stage-reviewer-agent returned NOT-READY and cited no finding",
        },
      ],
    });
  });

  test("a report at a new head before the board is covered restarts the board at that head", () => {
    expect(
      attemptStateOf({
        entries: [
          STAGE_RAISES_AT_THE_BOARD,
          report({
            lens: SYNTHESIS_LENS,
            verdict: "READY",
            findings: [],
            headSha: CLOSED_HEAD,
          }),
        ],
        policy: POLICY,
      }).phase,
    ).toBe("boarding");
  });

  test("a seat dispatch before the close leaves the attempt where it was", () => {
    expect(
      attemptStateOf({
        entries: [
          STAGE_RAISES_AT_THE_BOARD,
          SYNTHESIS_READY_AT_THE_BOARD,
          { kind: "seat-dispatch", agentType: "rin-architect-agent", at: "t" },
        ],
        policy: POLICY,
      }).phase,
    ).toBe("closing");
  });
});

describe("forwarded rows reach only the gate they name", () => {
  test("the named gate receives the row", () => {
    expect(
      inboundRowsOf({ gate: OPTIONS, earlierReceipts: [STANDING_RECEIPT] }),
    ).toEqual([FORWARDED_ROW]);
  });

  test("another gate receives nothing", () => {
    expect(
      inboundRowsOf({ gate: DESIGN, earlierReceipts: [STANDING_RECEIPT] }),
    ).toEqual([]);
  });

  test("an invalidated receipt forwards nothing", () => {
    expect(
      inboundRowsOf({
        gate: OPTIONS,
        earlierReceipts: [
          {
            ...STANDING_RECEIPT,
            validity: {
              kind: "invalidated",
              reason: { kind: "seat-dispatch", agentType: "rin-architect-agent" },
              at: "t",
            },
          },
        ],
      }),
    ).toEqual([]);
  });

  test("only later gates that run a board can take a forward", () => {
    expect(
      laterBoardGatesOf({ gate: OPTIONS, boardGates: [FRAMING, OPTIONS, DESIGN] }),
    ).toEqual([DESIGN]);
  });
});

describe("a ruled row reads as disposed only where closing rulings are honoured", () => {
  const forwardedLine = ruledRowLineOf({ ruledRow: FORWARDED_RULED_ROW });

  test("a forward disposes its row without a why-chain under the bounded close", () => {
    expect(
      blockingFindingsWithPolicy({
        findings: [forwardedLine],
        exceptionWhyChainsEnabled: true,
        closingRulingOutcomesEnabled: true,
      }),
    ).toEqual([]);
  });

  test("the same line still blocks where the bounded close is off", () => {
    expect(
      blockingFindingsWithPolicy({
        findings: [forwardedLine],
        exceptionWhyChainsEnabled: true,
      }),
    ).toEqual([forwardedLine]);
  });

  test("a defer still owes its why-chain under the bounded close", () => {
    expect(
      blockingFindingsWithPolicy({
        findings: ["| G1-R01: the defect | defer(ack:later) |  |"],
        exceptionWhyChainsEnabled: true,
        closingRulingOutcomesEnabled: true,
      }),
    ).toEqual(["| G1-R01: the defect | defer(ack:later) |  |"]);
  });
});

describe("the autonomy gate's reading of a closing receipt", () => {
  test("a standing receipt on the verdict's head with untouched artefacts is allowed", () => {
    expect(closeReceiptRefusalOf(HOLDING_CHECK)).toBeNull();
  });

  test("a gate with no receipt, a verdict from before the flag and nothing forwarded to it is allowed", () => {
    expect(
      closeReceiptRefusalOf({
        ...HOLDING_CHECK,
        receipt: null,
        verdictNamesReceipt: false,
      }),
    ).toBeNull();
  });

  test("a verdict closed by a receipt that is now missing is refused", () => {
    expect(
      closeReceiptRefusalOf({ ...HOLDING_CHECK, receipt: null }),
    ).toContain("a close whose receipt is missing authorises nothing");
  });

  test("bookkeeping written into the record after the close is allowed", () => {
    expect(
      closeReceiptRefusalOf({
        ...HOLDING_CHECK,
        changedPathsSinceClose: [AUDIT_SHARD],
      }),
    ).toBeNull();
  });

  test("a reviewed artefact edited after the close is refused", () => {
    expect(
      closeReceiptRefusalOf({
        ...HOLDING_CHECK,
        changedPathsSinceClose: [AUDIT_SHARD, REQUIREMENTS],
      }),
    ).toContain("was edited after 'rin-gate-1-framing' closed");
  });

  test("an invalidated receipt is refused", () => {
    expect(
      closeReceiptRefusalOf({
        ...HOLDING_CHECK,
        receipt: {
          ...STANDING_RECEIPT,
          validity: {
            kind: "invalidated",
            reason: { kind: "reviewer-dispatch", agentType: STAGE_LENS },
            at: "t",
          },
        },
      }),
    ).toContain("was invalidated");
  });

  test("a receipt that closed on another head than the verdict is refused", () => {
    expect(
      closeReceiptRefusalOf({ ...HOLDING_CHECK, verdictHeadSha: BOARD_HEAD }),
    ).toContain("do not describe the same close");
  });

  test("a forwarded row the gate has not ruled on is refused, with or without a receipt", () => {
    expect(
      closeReceiptRefusalOf({
        ...HOLDING_CHECK,
        gate: OPTIONS,
        receipt: null,
        inboundRows: [FORWARDED_ROW],
      }),
    ).toContain("1 row(s) forwarded to it");
  });

  test("a forwarded row the gate's receipt rules on is allowed", () => {
    expect(
      closeReceiptRefusalOf({ ...HOLDING_CHECK, inboundRows: [FORWARDED_ROW] }),
    ).toBeNull();
  });
});

const ruling = ({
  verdict,
  findings,
}: Pick<LensReportCapture, "verdict" | "findings">): AttemptLedgerEntry =>
  report({ lens: SYNTHESIS_LENS, verdict, findings, headSha: CLOSED_HEAD });

const OPEN_BOARD = attemptStateOf({
  entries: BOARD_WITH_ONE_FINDING,
  policy: POLICY,
});

const CLOSED_GATE = attemptStateOf({
  entries: [
    STAGE_RAISES_AT_THE_BOARD,
    SYNTHESIS_READY_AT_THE_BOARD,
    ruling({
      verdict: "READY",
      findings: ["G1-R01 | fixed@bbbbbbb | the facts row now exists"],
    }),
  ],
  policy: POLICY,
});

describe("a closing ruling settles every open row or is refused", () => {
  test("a ruling that fixes the row at a later commit closes the gate on the ruling's head", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | fixed@bbbbbbb | the facts row now exists"],
        }),
        policy: POLICY,
      }),
    ).toMatchObject({
      state: { phase: "closed" },
      event: {
        kind: "closed",
        closure: {
          closedBy: "closing-ruling",
          closedHeadSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          ruledRows: [
            { id: "G1-R01", outcome: { kind: "fixed", commitSha: "bbbbbbb" } },
          ],
        },
      },
      invalidation: null,
    });
  });

  test("a ruling that rejects the row with a ground closes the gate", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | rejected(the figure is a requirement) | "],
        }),
        policy: POLICY,
      }),
    ).toMatchObject({
      event: {
        kind: "closed",
        closure: {
          ruledRows: [
            {
              outcome: { kind: "rejected", ground: "the figure is a requirement" },
            },
          ],
        },
      },
    });
  });

  test("a ruling that forwards the row to a later gate with a board closes the gate", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | forwarded(rin-gate-2-plan-review) | later"],
        }),
        policy: POLICY,
      }),
    ).toMatchObject({
      event: {
        kind: "closed",
        closure: {
          ruledRows: [
            {
              outcome: { kind: "forwarded", toGate: "rin-gate-2-plan-review" },
            },
          ],
        },
      },
    });
  });

  test("a ruling whose own verdict is NOT-READY is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "NOT-READY",
          findings: ["G1-R01 | fixed@bbbbbbb | done"],
        }),
        policy: POLICY,
      }),
    ).toMatchObject({
      state: { phase: "closing" },
      event: {
        kind: "ruling-refused",
        problems: [{ kind: "ruling-not-ready" }],
      },
    });
  });

  test("a ruling that rules no row is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({ verdict: "READY", findings: [] }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [{ kind: "row-unruled", rowId: "G1-R01" }],
    });
  });

  test("a ruling that rules one row twice is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: [
            "G1-R01 | fixed@bbbbbbb | done",
            "G1-R01 | rejected(not a defect) | ",
          ],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [{ kind: "row-ruled-more-than-once", rowId: "G1-R01" }],
    });
  });

  test("a ruling on a row this gate never opened is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: [
            "G1-R01 | fixed@bbbbbbb | done",
            "G1-R07 | fixed@bbbbbbb | done",
          ],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [{ kind: "unknown-row", rowId: "G1-R07" }],
    });
  });

  test("an outcome outside the three is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | defer(ack:later) | later"],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [
        {
          kind: "outcome-unreadable",
          rowId: "G1-R01",
          claim: "defer(ack:later)",
        },
      ],
    });
  });

  test("a fix claimed at the commit the board read is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | fixed@aaaaaaa | already there"],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [{ kind: "fixed-without-a-later-commit", rowId: "G1-R01" }],
    });
  });

  test("a forward to an earlier gate is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | forwarded(rin-gate-0-reconcile) | later"],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [
        {
          kind: "forward-target-not-a-later-board-gate",
          rowId: "G1-R01",
          target: "rin-gate-0-reconcile",
        },
      ],
    });
  });

  test("a forward to a later gate that runs no board is refused", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: ruling({
          verdict: "READY",
          findings: ["G1-R01 | forwarded(rin-gate-6-operate) | later"],
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "ruling-refused",
      problems: [
        {
          kind: "forward-target-not-a-later-board-gate",
          rowId: "G1-R01",
          target: "rin-gate-6-operate",
        },
      ],
    });
  });
});

describe("a raising lens rechecks its own rows and nothing new is admitted", () => {
  test("its statement on its own row is recorded and its new finding is not admitted", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: report({
          lens: STAGE_LENS,
          verdict: "NOT-READY",
          findings: [
            "G1-R01 | STILL-OPEN | the row cites no command",
            "a.md:9 | another quote | DD-2 | first raised after the board",
          ],
          headSha: CLOSED_HEAD,
        }),
        policy: POLICY,
      }).event,
    ).toEqual({
      kind: "recheck-recorded",
      rechecks: [
        {
          rowId: "G1-R01",
          lens: "rin-stage-reviewer-agent",
          headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          claim: "STILL-OPEN",
        },
      ],
      unadmitted: [
        {
          lens: "rin-stage-reviewer-agent",
          headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          text: "a.md:9 | another quote | DD-2 | first raised after the board",
        },
      ],
    });
  });
});

describe("a closed gate is invalidated by further review, and only by that", () => {
  test("a reviewer reporting after the close invalidates it", () => {
    expect(
      stepAttempt({
        state: CLOSED_GATE,
        entry: report({
          lens: STAGE_LENS,
          verdict: "READY",
          findings: [],
          headSha: CLOSED_HEAD,
        }),
        policy: POLICY,
      }).invalidation,
    ).toEqual({
      kind: "reviewer-dispatch",
      agentType: "rin-stage-reviewer-agent",
    });
  });

  test("a seat dispatched after the close invalidates it", () => {
    expect(
      stepAttempt({
        state: CLOSED_GATE,
        entry: {
          kind: "seat-dispatch",
          agentType: "rin-architect-agent",
          at: "t",
        },
        policy: POLICY,
      }).invalidation,
    ).toEqual({ kind: "seat-dispatch", agentType: "rin-architect-agent" });
  });

  test("a seat dispatched before the close invalidates nothing", () => {
    expect(
      stepAttempt({
        state: OPEN_BOARD,
        entry: {
          kind: "seat-dispatch",
          agentType: "rin-architect-agent",
          at: "t",
        },
        policy: POLICY,
      }).invalidation,
    ).toBeNull();
  });
});

describe("refusals and invalidations read in plain words", () => {
  test("a ruling that is not READY", () => {
    expect(
      describeRulingProblem({ problem: { kind: "ruling-not-ready" } }),
    ).toBe("the closing ruling's own verdict is not READY");
  });

  test("a row with no outcome", () => {
    expect(
      describeRulingProblem({
        problem: { kind: "row-unruled", rowId: "G1-R01" },
      }),
    ).toBe("G1-R01 has no outcome");
  });

  test("a row ruled twice", () => {
    expect(
      describeRulingProblem({
        problem: { kind: "row-ruled-more-than-once", rowId: "G1-R01" },
      }),
    ).toBe("G1-R01 is ruled more than once");
  });

  test("a row the gate never opened", () => {
    expect(
      describeRulingProblem({
        problem: { kind: "unknown-row", rowId: "G1-R07" },
      }),
    ).toBe("G1-R07 is not an open row of this gate");
  });

  test("an outcome outside the three", () => {
    expect(
      describeRulingProblem({
        problem: {
          kind: "outcome-unreadable",
          rowId: "G1-R01",
          claim: "defer(ack:later)",
        },
      }),
    ).toBe(
      "G1-R01 carries 'defer(ack:later)', which is not fixed@<sha>, rejected(<ground>) or forwarded(<later gate>)",
    );
  });

  test("a fix with no later commit", () => {
    expect(
      describeRulingProblem({
        problem: { kind: "fixed-without-a-later-commit", rowId: "G1-R01" },
      }),
    ).toBe("G1-R01 is ruled fixed without a commit made after the board");
  });

  test("a forward to a gate that cannot take it", () => {
    expect(
      describeRulingProblem({
        problem: {
          kind: "forward-target-not-a-later-board-gate",
          rowId: "G1-R01",
          target: "rin-gate-6-operate",
        },
      }),
    ).toBe(
      "G1-R01 is forwarded to 'rin-gate-6-operate', which is not a later gate with a board",
    );
  });

  test("a reviewer reporting after the close", () => {
    expect(
      describeInvalidation({
        reason: {
          kind: "reviewer-dispatch",
          agentType: "rin-stage-reviewer-agent",
        },
      }),
    ).toBe("reviewer rin-stage-reviewer-agent reported after the gate closed");
  });

  test("a seat dispatched after the close", () => {
    expect(
      describeInvalidation({
        reason: { kind: "seat-dispatch", agentType: "rin-architect-agent" },
      }),
    ).toBe("seat rin-architect-agent was dispatched after the gate closed");
  });
});
