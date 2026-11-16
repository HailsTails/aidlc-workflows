import { describe, expect, test } from "vitest";
import {
  type AttemptLedgerEntry,
  attemptStateOf,
  type BoundedClosePolicy,
  type CloseReceipt,
  type CloseReceiptCheck,
  closeReceiptRefusalOf,
  inboundRowsOf,
  laterBoardGatesOf,
  type LensReportCapture,
  type ReviewRow,
  ruledRowLineOf,
} from "./rin-gates-bounded-close.ts";
import { blockingFindingsWithPolicy } from "./rin-gates-finding-disposition.ts";

const FRAMING = "rin-gate-1-framing";
const OPTIONS = "rin-gate-2-plan-review";
const DESIGN = "rin-gate-3-interface-lock";
const BOARD_HEAD = "a".repeat(40);
const CLOSED_HEAD = "b".repeat(40);
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

const BOARD_WITH_ONE_FINDING: readonly AttemptLedgerEntry[] = [
  report({
    lens: STAGE_LENS,
    verdict: "NOT-READY",
    findings: ["a.md:1 | the quote | DD-1 | the defect"],
    headSha: BOARD_HEAD,
  }),
  report({
    lens: SYNTHESIS_LENS,
    verdict: "READY",
    findings: [],
    headSha: BOARD_HEAD,
  }),
];

const FORWARDED_ROW: ReviewRow = {
  id: "G1-R01",
  lens: STAGE_LENS,
  text: "a.md:1 | the quote | DD-1 | the defect",
  origin: { kind: "forwarded", fromGate: FRAMING },
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
  rows: [
    {
      id: "G1-R01",
      lens: STAGE_LENS,
      text: "a.md:1 | the quote | DD-1 | the defect",
      origin: { kind: "raised" },
      outcome: { kind: "forwarded", toGate: OPTIONS },
      note: "",
    },
  ],
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
        entries: BOARD_WITH_ONE_FINDING.slice(0, 1),
        policy: POLICY,
      }).phase,
    ).toBe("boarding");
  });

  test("a covered board with a finding opens one row and waits for the ruling", () => {
    const state = attemptStateOf({
      entries: BOARD_WITH_ONE_FINDING,
      policy: POLICY,
    });
    expect(state.phase).toBe("closing");
    expect(state.phase === "closing" && state.rows.map((row) => row.id)).toEqual(
      ["G1-R01"],
    );
  });

  test("a NOT-READY that cites nothing still opens a row", () => {
    const state = attemptStateOf({
      entries: [
        report({
          lens: STAGE_LENS,
          verdict: "NOT-READY",
          findings: [],
          headSha: BOARD_HEAD,
        }),
        report({
          lens: SYNTHESIS_LENS,
          verdict: "READY",
          findings: [],
          headSha: BOARD_HEAD,
        }),
      ],
      policy: POLICY,
    });
    expect(
      state.phase === "closing" && state.rows.map((row) => row.text),
    ).toEqual([`${STAGE_LENS} returned NOT-READY and cited no finding`]);
  });

  test("a report at a new head before the board is covered restarts the board at that head", () => {
    const state = attemptStateOf({
      entries: [
        BOARD_WITH_ONE_FINDING[0] ?? report({
          lens: STAGE_LENS,
          verdict: "READY",
          findings: [],
          headSha: BOARD_HEAD,
        }),
        report({
          lens: SYNTHESIS_LENS,
          verdict: "READY",
          findings: [],
          headSha: CLOSED_HEAD,
        }),
      ],
      policy: POLICY,
    });
    expect(state.phase).toBe("boarding");
  });

  test("a seat dispatch before the close leaves the attempt where it was", () => {
    const state = attemptStateOf({
      entries: [
        ...BOARD_WITH_ONE_FINDING,
        { kind: "seat-dispatch", agentType: "rin-architect-agent", at: "t" },
      ],
      policy: POLICY,
    });
    expect(state.phase).toBe("closing");
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
  const forwardedLine = ruledRowLineOf({
    ruledRow: STANDING_RECEIPT.rows[0] ?? {
      ...FORWARDED_ROW,
      outcome: { kind: "forwarded", toGate: OPTIONS },
      note: "",
    },
  });

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
