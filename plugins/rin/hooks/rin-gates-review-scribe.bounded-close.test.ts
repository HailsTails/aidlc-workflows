import { describe, expect, onTestFinished, test } from "vitest";
import type { HandBack } from "../tools/rin-gates/review-history-replay.ts";
import {
  type BoundedCloseSetting,
  defaultReplayGatePorts,
  type InstalledScribeGate,
  installedScribeGate,
  type ScribeInstallation,
} from "../tools/rin-gates/review-history-replay-gate.ts";
import type { GateSlug } from "../tools/rin-gates/rin-gate-namespace.ts";
import type { CloseReceipt } from "../tools/rin-gates/rin-gates-bounded-close.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";

const paths = defaultPathOperations();
const PORTS = defaultReplayGatePorts();
const INSTALLATION: ScribeInstallation = {
  scribe: paths.resolve({
    segments: ["plugins/rin/hooks/rin-gates-review-scribe.ts"],
  }),
  rosterConfig: paths.resolve({
    segments: ["plugins/rin/tools/test-fixtures/bounded-close/review-rosters.json"],
  }),
  stageGraph: paths.resolve({
    segments: ["plugins/rin/tools/test-fixtures/bounded-close/stage-graph.json"],
  }),
  harnessConfig: paths.resolve({
    segments: ["plugins/rin/tools/test-fixtures/bounded-close/harness.config.json"],
  }),
};

const FRAMING = "rin-gate-1-framing";
const OPTIONS = "rin-gate-2-plan-review";
const RECORD = "260101-bounded-close";
const BOARD_HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FIX_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const STAGE_LENS = "rin-stage-reviewer-agent";
const CUSTOMER_LENS = "rin-customer-reviewer-agent";
const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const ARCHITECT_SEAT = "rin-architect-agent";

const STAGE_RAISES_AT_THE_BOARD: HandBack = {
  lens: STAGE_LENS,
  headSha: BOARD_HEAD,
  message:
    "## Verdict\n\nNOT-READY\n\n- rin-requirements.md:12 | the window is 02:00 | DD-1 | the figure has no facts row\n",
};
const STAGE_READY_AT_THE_BOARD: HandBack = {
  lens: STAGE_LENS,
  headSha: BOARD_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\n",
};
const CUSTOMER_READY_AT_THE_BOARD: HandBack = {
  lens: CUSTOMER_LENS,
  headSha: BOARD_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\n",
};
const SYNTHESIS_READY_AT_THE_BOARD: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: BOARD_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.\n",
};
const STAGE_READY_AT_THE_FIX: HandBack = {
  lens: STAGE_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n",
};
const CUSTOMER_READY_AT_THE_FIX: HandBack = {
  lens: CUSTOMER_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n",
};
const STAGE_RECHECKS_AND_RAISES_LATE: HandBack = {
  lens: STAGE_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nNOT-READY\n\n- G1-R01 | STILL-OPEN | the row cites no command\n- rin-requirements.md:40 | attendance is implied | DD-2 | first raised after the board\n",
};
const RULING_WITH_NO_ROWS: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n",
};
const RULING_FIXES_THE_ROW: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- G1-R01 | fixed@bbbbbbb | the facts row now exists\n",
};
const RULING_FORWARDS_THE_ROW: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- G1-R01 | forwarded(rin-gate-2-plan-review) | the options ledger owes the row\n",
};
const RULING_REJECTS_THE_ROW: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- G1-R01 | rejected(the figure is a requirement, not a fact) | \n",
};
const RULING_THAT_IS_NOT_READY: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message: "## Verdict\n\nNOT-READY\n\n- G1-R01 | fixed@bbbbbbb | done\n",
};
const RULING_FIXES_THE_FORWARDED_ROW: HandBack = {
  lens: SYNTHESIS_LENS,
  headSha: FIX_HEAD,
  message:
    "## Verdict\n\nREADY — reviewed at bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.\n\n- G1-R01 | fixed@ccccccc | the ledger carries the row\n",
};
const ARCHITECT_SEAT_STOPS: HandBack = {
  lens: ARCHITECT_SEAT,
  headSha: FIX_HEAD,
  message: "Checked the redraft.",
};
const UNRELATED_AGENT_STOPS: HandBack = {
  lens: "Explore",
  headSha: FIX_HEAD,
  message: "Found the file.",
};

const FORWARDED_FROM_FRAMING: CloseReceipt = {
  schemaVersion: 1,
  gate: FRAMING,
  record: RECORD,
  attempt: 1,
  validity: { kind: "standing" },
  closedBy: "closing-ruling",
  boardHeadSha: BOARD_HEAD,
  closedHeadSha: BOARD_HEAD,
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [
    {
      id: "G1-R01",
      lens: STAGE_LENS,
      text: "rin-requirements.md:12 | the window is 02:00 | DD-1 | the figure has no facts row",
      origin: { kind: "raised" },
      outcome: { kind: "forwarded", toGate: OPTIONS },
      note: "the options ledger owes the row",
    },
  ],
  rechecks: [],
  unadmitted: [],
  emittedBy: "rin-gates-review-scribe",
};

const openGate = ({
  gate,
  boundedClose,
}: {
  readonly gate: GateSlug;
  readonly boundedClose: BoundedCloseSetting;
}): InstalledScribeGate => {
  const opened = installedScribeGate({
    record: RECORD,
    gate,
    boundedClose,
    installation: INSTALLATION,
    ports: PORTS,
  });
  onTestFinished(opened.dispose);
  return opened;
};

const runBoardWithOneFinding = async (
  gate: InstalledScribeGate,
): Promise<string> => {
  await gate.handBack(STAGE_RAISES_AT_THE_BOARD);
  await gate.handBack(CUSTOMER_READY_AT_THE_BOARD);
  return gate.handBack(SYNTHESIS_READY_AT_THE_BOARD);
};

const closeFraming = async (): Promise<InstalledScribeGate> => {
  const gate = openGate({ gate: FRAMING, boundedClose: "all" });
  await runBoardWithOneFinding(gate);
  await gate.handBack(RULING_FIXES_THE_ROW);
  return gate;
};

describe("with the flag off a fix commit still forces a whole board", () => {
  test("the raising lens and a ruling at the new head write no READY and no receipt", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "off" });
    await runBoardWithOneFinding(gate);
    await gate.handBack(STAGE_READY_AT_THE_FIX);
    await gate.handBack(RULING_FIXES_THE_ROW);
    expect(gate.verdict()).toMatchObject({
      verdict: "NOT-READY",
      headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      isClosedByReceipt: false,
    });
    expect(gate.receipt()).toBeNull();
  });

  test("a seat stop writes nothing at all", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "off" });
    expect(await gate.handBack(ARCHITECT_SEAT_STOPS)).toBe("");
    expect(gate.reviewTrace()).toBeUndefined();
    expect(gate.verdict()).toMatchObject({ verdict: "NONE" });
  });
});

describe("with the flag on the first board is the only full board", () => {
  test("a clean board closes the gate on its own", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await gate.handBack(STAGE_READY_AT_THE_BOARD);
    await gate.handBack(CUSTOMER_READY_AT_THE_BOARD);
    await gate.handBack(SYNTHESIS_READY_AT_THE_BOARD);
    expect(gate.verdict()).toMatchObject({
      verdict: "READY",
      isClosedByReceipt: true,
    });
    expect(gate.receipt()).toMatchObject({ closedBy: "clean-board" });
  });

  test("a board with a finding names its rows and stays NOT-READY", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    expect(await runBoardWithOneFinding(gate)).toContain(
      "This was the gate's one full board",
    );
    expect(gate.verdict()).toMatchObject({
      verdict: "NOT-READY",
      blockingFindings: [
        "G1-R01 | rin-stage-reviewer-agent | rin-requirements.md:12 | the window is 02:00 | DD-1 | the figure has no facts row",
      ],
    });
    expect(gate.receipt()).toBeNull();
  });

  test("a READY lens keeps its READY across the fix commit and the ruling closes on the final head", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    await gate.handBack(RULING_FIXES_THE_ROW);
    expect(gate.verdict()).toMatchObject({
      verdict: "READY",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lenses: [
        "rin-stage-reviewer-agent",
        "rin-customer-reviewer-agent",
        "rin-intent-defense-reviewer-agent",
      ],
      blockingFindings: [],
    });
    expect(gate.receipt()).toMatchObject({
      boardHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      closedHeadSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      rows: [{ outcome: { kind: "fixed", commitSha: "bbbbbbb" } }],
    });
  });

  test("the ruling closes the gate while the raising lens is still NOT-READY, and its late finding is not admitted", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    expect(await gate.handBack(STAGE_RECHECKS_AND_RAISES_LATE)).toContain(
      "NOT ADMITTED",
    );
    await gate.handBack(RULING_FORWARDS_THE_ROW);
    expect(gate.verdict()).toMatchObject({ verdict: "READY" });
    expect(gate.receipt()).toMatchObject({
      rows: [
        { outcome: { kind: "forwarded", toGate: "rin-gate-2-plan-review" } },
      ],
      rechecks: [{ claim: "STILL-OPEN" }],
      unadmitted: [
        {
          text: "rin-requirements.md:40 | attendance is implied | DD-2 | first raised after the board",
        },
      ],
    });
  });

  test("a rejected row closes the gate with its ground and no chain", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    await gate.handBack(RULING_REJECTS_THE_ROW);
    expect(gate.verdict()).toMatchObject({ verdict: "READY" });
    expect(gate.receipt()).toMatchObject({
      rows: [
        {
          outcome: {
            kind: "rejected",
            ground: "the figure is a requirement, not a fact",
          },
        },
      ],
    });
  });
});

describe("a closing ruling that does not settle every row is refused", () => {
  test("a ruling that rules no row leaves the gate NOT-READY with no receipt", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    const refusal = await gate.handBack(RULING_WITH_NO_ROWS);
    expect(refusal).toContain("closing ruling refused");
    expect(refusal).toContain("G1-R01 has no outcome");
    expect(gate.verdict()).toMatchObject({ verdict: "NOT-READY" });
    expect(gate.receipt()).toBeNull();
  });

  test("a ruling whose own verdict is NOT-READY is refused", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    expect(await gate.handBack(RULING_THAT_IS_NOT_READY)).toContain(
      "own verdict is not READY",
    );
    expect(gate.receipt()).toBeNull();
  });

  test("a refused ruling is followed by one that settles the row", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    await gate.handBack(RULING_WITH_NO_ROWS);
    await gate.handBack(RULING_FIXES_THE_ROW);
    expect(gate.verdict()).toMatchObject({ verdict: "READY" });
  });
});

describe("a forwarded row is carried into its target gate", () => {
  test("an otherwise clean board at the target gate stays open on the forwarded row", async () => {
    const gate = openGate({ gate: OPTIONS, boundedClose: "all" });
    gate.carryReceipt(FORWARDED_FROM_FRAMING);
    await gate.handBack(STAGE_READY_AT_THE_FIX);
    await gate.handBack(CUSTOMER_READY_AT_THE_FIX);
    await gate.handBack(RULING_WITH_NO_ROWS);
    expect(gate.verdict()).toMatchObject({
      verdict: "NOT-READY",
      blockingFindings: [
        "G1-R01 | rin-stage-reviewer-agent | rin-requirements.md:12 | the window is 02:00 | DD-1 | the figure has no facts row",
      ],
    });
  });

  test("the target gate's board closes once its ruling disposes the forwarded row", async () => {
    const gate = openGate({ gate: OPTIONS, boundedClose: "all" });
    gate.carryReceipt(FORWARDED_FROM_FRAMING);
    await gate.handBack(STAGE_READY_AT_THE_FIX);
    await gate.handBack(CUSTOMER_READY_AT_THE_FIX);
    await gate.handBack(RULING_FIXES_THE_FORWARDED_ROW);
    expect(gate.verdict()).toMatchObject({ verdict: "READY" });
    expect(gate.receipt()).toMatchObject({
      rows: [{ origin: { kind: "forwarded", fromGate: "rin-gate-1-framing" } }],
    });
  });
});

describe("after the closing ruling the receipt is invalidated by further review", () => {
  test("a reviewer reporting again invalidates the receipt and the verdict", async () => {
    const gate = await closeFraming();
    expect(await gate.handBack(CUSTOMER_READY_AT_THE_FIX)).toContain(
      "INVALIDATED",
    );
    expect(gate.receipt()).toMatchObject({
      validity: {
        kind: "invalidated",
        reason: {
          kind: "reviewer-dispatch",
          agentType: "rin-customer-reviewer-agent",
        },
      },
    });
    expect(gate.verdict()).toMatchObject({ verdict: "NOT-READY" });
  });

  test("a seat dispatched again invalidates the receipt and the verdict", async () => {
    const gate = await closeFraming();
    await gate.handBack(ARCHITECT_SEAT_STOPS);
    expect(gate.receipt()).toMatchObject({
      validity: {
        kind: "invalidated",
        reason: { kind: "seat-dispatch", agentType: "rin-architect-agent" },
      },
    });
    expect(gate.verdict()).toMatchObject({ verdict: "NOT-READY" });
  });

  test("an agent that is neither a reviewer nor a seat of the gate leaves the receipt standing", async () => {
    const gate = await closeFraming();
    await gate.handBack(UNRELATED_AGENT_STOPS);
    expect(gate.receipt()).toMatchObject({ validity: { kind: "standing" } });
    expect(gate.verdict()).toMatchObject({ verdict: "READY" });
  });

  test("a seat dispatched before the gate closed changes nothing", async () => {
    const gate = openGate({ gate: FRAMING, boundedClose: "all" });
    await runBoardWithOneFinding(gate);
    await gate.handBack(ARCHITECT_SEAT_STOPS);
    await gate.handBack(RULING_FIXES_THE_ROW);
    expect(gate.receipt()).toMatchObject({ validity: { kind: "standing" } });
  });
});
