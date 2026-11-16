import { describe, expect, onTestFinished, test } from "vitest";
import { defaultReviewDecodersPort } from "../tools/rin-gates/review-decoders-port.ts";
import { defaultReviewProcessPort } from "../tools/rin-gates/review-process-port.ts";
import type { CloseReceipt } from "../tools/rin-gates/rin-gates-bounded-close.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();
const runtime = defaultReviewProcessPort();
const decoders = defaultReviewDecodersPort();
const join = (...segments: string[]): string => paths.join({ segments });
const HERE = paths.dirname({ path: paths.fromFileUrl({ url: import.meta.url }) });
const SCRIBE = join(HERE, "rin-gates-review-scribe.ts");

const FRAMING = "rin-gate-1-framing";
const OPTIONS = "rin-gate-2-plan-review";
const RECORD = "260101-bounded-close";
const BOARD_HEAD = "a".repeat(40);
const FIX_HEAD = "b".repeat(40);
const STAGE_LENS = "rin-stage-reviewer-agent";
const CUSTOMER_LENS = "rin-customer-reviewer-agent";
const SYNTHESIS_LENS = "rin-intent-defense-reviewer-agent";
const BOARD_ROSTER: readonly string[] = [
  STAGE_LENS,
  CUSTOMER_LENS,
  SYNTHESIS_LENS,
];
const ARCHITECT_SEAT = "rin-architect-agent";
const FINDING =
  "rin-requirements.md:12 | the window is 02:00 | DD-1 | the figure has no facts row";
const LATE_FINDING =
  "rin-requirements.md:40 | attendance is implied | DD-2 | first raised after the board";

type BoundedCloseSetting = "off" | "all";

type Checkout = {
  readonly root: string;
  readonly recordDir: string;
};

type ScribeRun = {
  readonly stderr: string;
  readonly discards: readonly string[];
};

const notReady = ({
  lines,
}: {
  readonly lines: readonly string[];
}): string =>
  `## Verdict\n\nNOT-READY\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`;

const readyAt = ({
  headSha,
  lines,
}: {
  readonly headSha: string;
  readonly lines: readonly string[];
}): string =>
  `## Verdict\n\nREADY — reviewed at ${headSha}.\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`;

const buildCheckout = ({
  boundedClose,
  gate,
}: {
  readonly boundedClose: BoundedCloseSetting;
  readonly gate: string;
}): Checkout => {
  const root = files.makeTemporaryDirectory(
    join(files.temporaryRoot(), "rin-bounded-close-"),
  );
  onTestFinished(() => files.remove(root, { recursive: true, force: true }));
  const intents = join(root, "aidlc", "spaces", "default", "intents");
  const recordDir = join(intents, RECORD);
  files.mkdir(recordDir, { recursive: true });
  files.mkdir(join(root, ".git"), { recursive: true });
  files.write(join(intents, "active-intent"), RECORD);
  files.write(join(recordDir, "aidlc-state.md"), `**Current Stage**: ${gate}\n`);
  files.write(
    join(root, "harness.config.json"),
    JSON.stringify({
      projectName: "ada",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { oneBoardBoundedClose: boundedClose },
    }),
  );
  files.write(
    join(root, "review-rosters.json"),
    JSON.stringify({
      defaultRoster: [STAGE_LENS],
      byGate: { [FRAMING]: BOARD_ROSTER, [OPTIONS]: BOARD_ROSTER },
    }),
  );
  files.write(
    join(root, "stage-graph.json"),
    JSON.stringify([
      {
        slug: gate,
        phase: "inception",
        scopes: ["rin-gates"],
        reviewer: "rin-decorrelated-review-agent",
        lead_agent: "rin-product-agent",
        support_agents: [ARCHITECT_SEAT],
        produces: ["rin-requirements"],
      },
    ]),
  );
  files.write(join(root, "fake-aidlc-log.ts"), "");
  return { root, recordDir };
};

const inheritedEnvironment = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(runtime.environment).flatMap(([name, setting]) =>
      setting === undefined || name.startsWith("RIN_GATES_")
        ? []
        : [[name, setting]],
    ),
  );

const readLines = (path: string): readonly string[] =>
  files.exists(path)
    ? files
        .read(path)
        .split("\n")
        .filter((line) => line.trim() !== "")
    : [];

const stop = async ({
  checkout,
  agentType,
  headSha,
  message,
}: {
  readonly checkout: Checkout;
  readonly agentType: string;
  readonly headSha: string;
  readonly message: string;
}): Promise<ScribeRun> => {
  const result = await runtime.run({
    program: "bun",
    args: [SCRIBE],
    environment: {
      ...inheritedEnvironment(),
      ["RIN_GATES_TEST_MODE"]: "1",
      ["RIN_GATES_SPACE"]: "default",
      ["RIN_GATES_HEAD_SHA"]: headSha,
      ["RIN_GATES_REVIEW_TRACE_PATH"]: join(checkout.root, "trace.jsonl"),
      ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: join(
        checkout.root,
        "discards.jsonl",
      ),
      ["RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH"]: join(
        checkout.root,
        "handbacks.jsonl",
      ),
      ["RIN_GATES_REVIEW_CAPTURES_DIR"]: join(checkout.root, "captures"),
      ["RIN_GATES_ENGINE_LOG_PATH"]: join(checkout.root, "fake-aidlc-log.ts"),
      ["RIN_GATES_ROSTER_CONFIG"]: join(checkout.root, "review-rosters.json"),
      ["AIDLC_STAGE_GRAPH"]: join(checkout.root, "stage-graph.json"),
    },
    input: JSON.stringify({
      agent_type: agentType,
      agent_id: `${agentType}-${headSha.slice(0, 4)}`,
      last_assistant_message: message,
      cwd: checkout.root,
      session_id: "bounded-close-session",
    }),
  });
  return {
    stderr: result.stderr,
    discards: readLines(join(checkout.root, "discards.jsonl")),
  };
};

const gatePath = ({
  checkout,
  gate,
  file,
}: {
  readonly checkout: Checkout;
  readonly gate: string;
  readonly file: string;
}): string => join(checkout.recordDir, "inception", gate, file);

const verdictAt = ({
  checkout,
  gate,
}: {
  readonly checkout: Checkout;
  readonly gate: string;
}): Record<string, unknown> =>
  JSON.parse(
    files.read(gatePath({ checkout, gate, file: "review-verdict.json" })),
  ) as Record<string, unknown>;

const receiptAt = ({
  checkout,
  gate,
}: {
  readonly checkout: Checkout;
  readonly gate: string;
}): CloseReceipt | null => {
  const path = gatePath({ checkout, gate, file: "review-close.json" });
  if (!files.exists(path)) return null;
  const decoded = decoders.closeReceipt(JSON.parse(files.read(path)));
  return decoded.success ? decoded.data : null;
};

const runBoardWithOneFinding = async ({
  checkout,
}: {
  readonly checkout: Checkout;
}): Promise<ScribeRun> => {
  await stop({
    checkout,
    agentType: STAGE_LENS,
    headSha: BOARD_HEAD,
    message: notReady({ lines: [FINDING] }),
  });
  await stop({
    checkout,
    agentType: CUSTOMER_LENS,
    headSha: BOARD_HEAD,
    message: readyAt({ headSha: BOARD_HEAD, lines: [] }),
  });
  return stop({
    checkout,
    agentType: SYNTHESIS_LENS,
    headSha: BOARD_HEAD,
    message: readyAt({ headSha: BOARD_HEAD, lines: [] }),
  });
};

const rule = ({
  checkout,
  lines,
  headSha,
}: {
  readonly checkout: Checkout;
  readonly lines: readonly string[];
  readonly headSha: string;
}): Promise<ScribeRun> =>
  stop({
    checkout,
    agentType: SYNTHESIS_LENS,
    headSha,
    message: readyAt({ headSha, lines }),
  });

describe("with the flag off a fix commit still forces a whole board", () => {
  test("the raising lens alone at the new head writes no READY and no receipt", async () => {
    const checkout = buildCheckout({ boundedClose: "off", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    await stop({
      checkout,
      agentType: STAGE_LENS,
      headSha: FIX_HEAD,
      message: readyAt({ headSha: FIX_HEAD, lines: [] }),
    });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | fixed@bbbbbbb | the facts row now exists"],
    });
    const verdict = verdictAt({ checkout, gate: FRAMING });
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["headSha"]).toBe(BOARD_HEAD);
    expect(verdict["boundedClose"]).toBeUndefined();
    expect(receiptAt({ checkout, gate: FRAMING })).toBeNull();
    expect(files.exists(join(checkout.root, "captures", "attempts"))).toBe(
      false,
    );
  });
});

describe("with the flag on the first board is the only full board", () => {
  test("a clean board closes the gate on its own", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await stop({
      checkout,
      agentType: STAGE_LENS,
      headSha: BOARD_HEAD,
      message: readyAt({ headSha: BOARD_HEAD, lines: [] }),
    });
    await stop({
      checkout,
      agentType: CUSTOMER_LENS,
      headSha: BOARD_HEAD,
      message: readyAt({ headSha: BOARD_HEAD, lines: [] }),
    });
    await rule({ checkout, headSha: BOARD_HEAD, lines: [] });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("READY");
    expect(receiptAt({ checkout, gate: FRAMING })?.closedBy).toBe(
      "clean-board",
    );
  });

  test("a board with a finding names its rows and stays NOT-READY", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    const board = await runBoardWithOneFinding({ checkout });
    const verdict = verdictAt({ checkout, gate: FRAMING });
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["blockingFindings"]).toEqual([
      `G1-R01 | ${STAGE_LENS} | ${FINDING}`,
    ]);
    expect(board.stderr).toContain("This was the gate's one full board");
    expect(receiptAt({ checkout, gate: FRAMING })).toBeNull();
  });

  test("a READY lens keeps its READY across the fix commit and the ruling closes on the final head", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | fixed@bbbbbbb | the facts row now exists"],
    });
    const verdict = verdictAt({ checkout, gate: FRAMING });
    expect(verdict["verdict"]).toBe("READY");
    expect(verdict["headSha"]).toBe(FIX_HEAD);
    expect(verdict["lenses"]).toEqual(BOARD_ROSTER);
    expect(verdict["blockingFindings"]).toEqual([]);
    const receipt = receiptAt({ checkout, gate: FRAMING });
    expect(receipt?.boardHeadSha).toBe(BOARD_HEAD);
    expect(receipt?.closedHeadSha).toBe(FIX_HEAD);
    expect(receipt?.rows.map((row) => row.outcome)).toEqual([
      { kind: "fixed", commitSha: "bbbbbbb" },
    ]);
  });

  test("the ruling closes the gate while the raising lens is still NOT-READY, and its late finding is not admitted", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    const recheck = await stop({
      checkout,
      agentType: STAGE_LENS,
      headSha: FIX_HEAD,
      message: notReady({
        lines: ["G1-R01 | STILL-OPEN | the row cites no command", LATE_FINDING],
      }),
    });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: [`G1-R01 | forwarded(${OPTIONS}) | the options ledger owes the row`],
    });
    const receipt = receiptAt({ checkout, gate: FRAMING });
    expect(recheck.stderr).toContain("NOT ADMITTED");
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("READY");
    expect(receipt?.rows.map((row) => row.outcome)).toEqual([
      { kind: "forwarded", toGate: OPTIONS },
    ]);
    expect(receipt?.rechecks.map((recheck) => recheck.claim)).toEqual([
      "STILL-OPEN",
    ]);
    expect(receipt?.unadmitted.map((finding) => finding.text)).toEqual([
      LATE_FINDING,
    ]);
  });

  test("a rejected row closes the gate with its ground and no chain", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | rejected(the figure is a requirement, not a fact) | "],
    });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("READY");
    expect(
      receiptAt({ checkout, gate: FRAMING })?.rows.map((row) => row.outcome),
    ).toEqual([
      { kind: "rejected", ground: "the figure is a requirement, not a fact" },
    ]);
  });
});

describe("a closing ruling that does not settle every row is refused", () => {
  test.each([
    ["rules no row", [], "G1-R01 has no outcome"],
    [
      "forwards to an earlier gate",
      ["G1-R01 | forwarded(rin-gate-0-reconcile) | later"],
      "is not a later gate with a board",
    ],
    [
      "forwards to a later gate that has no board",
      ["G1-R01 | forwarded(rin-gate-6-operate) | later"],
      "is not a later gate with a board",
    ],
    [
      "claims a fix at the commit the board read",
      ["G1-R01 | fixed@aaaaaaa | already there"],
      "without a commit made after the board",
    ],
    [
      "uses an outcome outside the three",
      ["G1-R01 | defer(ack:later) | later"],
      "is not fixed@<sha>, rejected(<ground>) or forwarded(<later gate>)",
    ],
    [
      "rules a row this gate never opened",
      ["G1-R01 | fixed@bbbbbbb | done", "G1-R07 | fixed@bbbbbbb | done"],
      "G1-R07 is not an open row of this gate",
    ],
  ] as const)("a ruling that %s", async (_label, lines, reason) => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    const ruling = await rule({ checkout, headSha: FIX_HEAD, lines });
    expect(ruling.stderr).toContain("closing ruling refused");
    expect(ruling.stderr).toContain(reason);
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("NOT-READY");
    expect(receiptAt({ checkout, gate: FRAMING })).toBeNull();
  });

  test("a ruling whose own verdict is NOT-READY", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    const ruling = await stop({
      checkout,
      agentType: SYNTHESIS_LENS,
      headSha: FIX_HEAD,
      message: notReady({ lines: ["G1-R01 | fixed@bbbbbbb | done"] }),
    });
    expect(ruling.stderr).toContain("own verdict is not READY");
    expect(receiptAt({ checkout, gate: FRAMING })).toBeNull();
  });

  test("a refused ruling is followed by one that settles the row", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    await rule({ checkout, headSha: FIX_HEAD, lines: [] });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | fixed@bbbbbbb | done"],
    });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("READY");
  });
});

const forwardedFromFraming: CloseReceipt = {
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
      text: FINDING,
      origin: { kind: "raised" },
      outcome: { kind: "forwarded", toGate: OPTIONS },
      note: "the options ledger owes the row",
    },
  ],
  rechecks: [],
  unadmitted: [],
  emittedBy: "rin-gates-review-scribe",
};

const buildOptionsCheckoutWithForward = (): Checkout => {
  const checkout = buildCheckout({ boundedClose: "all", gate: OPTIONS });
  files.mkdir(join(checkout.recordDir, "inception", FRAMING), {
    recursive: true,
  });
  files.write(
    gatePath({ checkout, gate: FRAMING, file: "review-close.json" }),
    JSON.stringify(forwardedFromFraming),
  );
  return checkout;
};

const runCleanProducingLenses = async ({
  checkout,
}: {
  readonly checkout: Checkout;
}): Promise<void> => {
  await stop({
    checkout,
    agentType: STAGE_LENS,
    headSha: FIX_HEAD,
    message: readyAt({ headSha: FIX_HEAD, lines: [] }),
  });
  await stop({
    checkout,
    agentType: CUSTOMER_LENS,
    headSha: FIX_HEAD,
    message: readyAt({ headSha: FIX_HEAD, lines: [] }),
  });
};

describe("a forwarded row is carried into its target gate", () => {
  test("an otherwise clean board at the target gate stays open on the forwarded row", async () => {
    const checkout = buildOptionsCheckoutWithForward();
    await runCleanProducingLenses({ checkout });
    await rule({ checkout, headSha: FIX_HEAD, lines: [] });
    const verdict = verdictAt({ checkout, gate: OPTIONS });
    expect(verdict["verdict"]).toBe("NOT-READY");
    expect(verdict["blockingFindings"]).toEqual([
      `G1-R01 | ${STAGE_LENS} | ${FINDING}`,
    ]);
  });

  test("the target gate's board closes once its ruling disposes the forwarded row", async () => {
    const checkout = buildOptionsCheckoutWithForward();
    await runCleanProducingLenses({ checkout });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | fixed@ccccccc | the ledger carries the row"],
    });
    expect(verdictAt({ checkout, gate: OPTIONS })["verdict"]).toBe("READY");
    expect(
      receiptAt({ checkout, gate: OPTIONS })?.rows.map((row) => row.origin),
    ).toEqual([{ kind: "forwarded", fromGate: FRAMING }]);
  });
});

const closeFraming = async (): Promise<Checkout> => {
  const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
  await runBoardWithOneFinding({ checkout });
  await rule({
    checkout,
    headSha: FIX_HEAD,
    lines: ["G1-R01 | fixed@bbbbbbb | done"],
  });
  return checkout;
};

describe("after the closing ruling the receipt is invalidated by further review", () => {
  test("a reviewer reporting again invalidates the receipt and the verdict", async () => {
    const checkout = await closeFraming();
    const late = await stop({
      checkout,
      agentType: CUSTOMER_LENS,
      headSha: FIX_HEAD,
      message: readyAt({ headSha: FIX_HEAD, lines: [] }),
    });
    expect(late.stderr).toContain("INVALIDATED");
    expect(receiptAt({ checkout, gate: FRAMING })?.validity).toMatchObject({
      kind: "invalidated",
      reason: { kind: "reviewer-dispatch", agentType: CUSTOMER_LENS },
    });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("NOT-READY");
  });

  test("a seat dispatched again invalidates the receipt and the verdict", async () => {
    const checkout = await closeFraming();
    await stop({
      checkout,
      agentType: ARCHITECT_SEAT,
      headSha: FIX_HEAD,
      message: "Checked the redraft.",
    });
    expect(receiptAt({ checkout, gate: FRAMING })?.validity).toMatchObject({
      kind: "invalidated",
      reason: { kind: "seat-dispatch", agentType: ARCHITECT_SEAT },
    });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("NOT-READY");
  });

  test("an agent that is neither a reviewer nor a seat of the gate leaves the receipt standing", async () => {
    const checkout = await closeFraming();
    await stop({
      checkout,
      agentType: "Explore",
      headSha: FIX_HEAD,
      message: "Found the file.",
    });
    expect(receiptAt({ checkout, gate: FRAMING })?.validity).toEqual({
      kind: "standing",
    });
    expect(verdictAt({ checkout, gate: FRAMING })["verdict"]).toBe("READY");
  });

  test("a seat dispatched before the gate closed changes nothing", async () => {
    const checkout = buildCheckout({ boundedClose: "all", gate: FRAMING });
    await runBoardWithOneFinding({ checkout });
    await stop({
      checkout,
      agentType: ARCHITECT_SEAT,
      headSha: FIX_HEAD,
      message: "Drafted the fix.",
    });
    await rule({
      checkout,
      headSha: FIX_HEAD,
      lines: ["G1-R01 | fixed@bbbbbbb | done"],
    });
    expect(receiptAt({ checkout, gate: FRAMING })?.validity).toEqual({
      kind: "standing",
    });
  });

  test("with the flag off a seat stop writes nothing at all", async () => {
    const checkout = buildCheckout({ boundedClose: "off", gate: FRAMING });
    const seat = await stop({
      checkout,
      agentType: ARCHITECT_SEAT,
      headSha: FIX_HEAD,
      message: "Drafted the fix.",
    });
    expect(seat.stderr).toBe("");
    expect(files.exists(join(checkout.root, "trace.jsonl"))).toBe(false);
    expect(files.exists(join(checkout.root, "captures"))).toBe(false);
  });
});
