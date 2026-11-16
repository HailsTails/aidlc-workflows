import { describe, expect, test } from "vitest";
import {
  installedScribeGate,
  type ReplayGatePorts,
  replayAgainstInstalledScribe,
  type ScribeInstallation,
  type ScribeRun,
} from "./review-history-replay-gate.ts";
import type { CloseReceipt } from "./rin-gates-bounded-close.ts";

const INSTALLATION: ScribeInstallation = {
  scribe: "/repo/hooks/rin-gates-review-scribe.ts",
  rosterConfig: "/repo/hooks/review-rosters.json",
  stageGraph: "/repo/tools/data/stage-graph.json",
  harnessConfig: "/repo/harness.config.json",
};

const HISTORY_TEXT =
  '{"record":"260101-sample","gate":"rin-gate-2-plan-review","roster":["rin-stage-reviewer-agent","rin-intent-defense-reviewer-agent"],"rounds":[{"ordinal":1,"headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},{"ordinal":2,"headSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}],"rows":[]}';

const GATE_DIRECTORY =
  "/tmp/replay/aidlc/spaces/default/intents/260101-sample/inception/rin-gate-2-plan-review";

const FRAMING_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: "rin-gate-1-framing",
  record: "260101-sample",
  attempt: 1,
  validity: { kind: "standing" },
  closedBy: "clean-board",
  boardHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  closedHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [],
  rechecks: [],
  unadmitted: [],
  emittedBy: "rin-gates-review-scribe",
};

type FakeCheckout = {
  readonly ports: ReplayGatePorts;
  readonly created: string[];
  readonly removed: string[];
  readonly written: Map<string, string>;
  readonly runs: ScribeRun[];
};

const fakeCheckout = ({
  seeded,
}: {
  readonly seeded: ReadonlyMap<string, string>;
}): FakeCheckout => {
  const created: string[] = [];
  const removed: string[] = [];
  const written = new Map<string, string>();
  const runs: ScribeRun[] = [];
  return {
    created,
    removed,
    written,
    runs,
    ports: {
      join: (...segments) => segments.join("/"),
      createTemporaryDirectory: () => "/tmp/replay",
      createDirectory: (path) => {
        created.push(path);
      },
      removeDirectory: (path) => {
        removed.push(path);
      },
      writeText: (path, text) => {
        written.set(path, text);
      },
      readText: (path) => seeded.get(path),
      ambientEnvironment: {
        ["PATH"]: "/bin",
        ["RIN_GATES_HEAD_SHA"]: "leaked-from-the-developer-shell",
        ["UNSET_VARIABLE"]: undefined,
      },
      runScribe: async (run) => {
        runs.push(run);
        return "the scribe's diagnostics";
      },
      decodeReceipt: () => FRAMING_RECEIPT,
    },
  };
};

const INSTALLED_CONFIG: ReadonlyMap<string, string> = new Map([
  [
    "/repo/harness.config.json",
    '{"projectName":"ada","rinGates":{"exceptionWhyChains":true}}',
  ],
]);

describe("the replay checkout is a throwaway record at the replayed gate", () => {
  test("it creates the gate directory and a git marker", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: "off",
      installation: INSTALLATION,
      ports: checkout.ports,
    });
    expect(checkout.created).toEqual([
      "/tmp/replay/aidlc/spaces/default/intents/260101-sample/inception/rin-gate-2-plan-review",
      "/tmp/replay/.git",
    ]);
  });

  test("it points the cursor and the state file at the record and gate", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: "off",
      installation: INSTALLATION,
      ports: checkout.ports,
    });
    expect(
      checkout.written.get(
        "/tmp/replay/aidlc/spaces/default/intents/active-intent",
      ),
    ).toBe("260101-sample");
    expect(
      checkout.written.get(
        "/tmp/replay/aidlc/spaces/default/intents/260101-sample/aidlc-state.md",
      ),
    ).toBe("**Current Stage**: rin-gate-2-plan-review\n");
  });

  test("it keeps the installed config and sets only the flag", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: { records: ["260101-sample"] },
      installation: INSTALLATION,
      ports: checkout.ports,
    });
    expect(checkout.written.get("/tmp/replay/harness.config.json")).toBe(
      '{"projectName":"ada","rinGates":{"exceptionWhyChains":true,"oneBoardBoundedClose":{"records":["260101-sample"]}}}',
    );
  });

  test("an earlier gate's receipt is carried into that gate's directory", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: "all",
      installation: INSTALLATION,
      ports: checkout.ports,
    }).carryReceipt(FRAMING_RECEIPT);
    expect(
      checkout.written.get(
        "/tmp/replay/aidlc/spaces/default/intents/260101-sample/inception/rin-gate-1-framing/review-close.json",
      ),
    ).toBe(
      '{"schemaVersion":1,"gate":"rin-gate-1-framing","record":"260101-sample","attempt":1,"validity":{"kind":"standing"},"closedBy":"clean-board","boardHeadSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","closedHeadSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","closedAt":"2026-01-01T00:00:00.000Z","carriedLenses":[],"rows":[],"rechecks":[],"unadmitted":[],"emittedBy":"rin-gates-review-scribe"}',
    );
  });

  test("dispose removes the checkout it created", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: "off",
      installation: INSTALLATION,
      ports: checkout.ports,
    }).dispose();
    expect(checkout.removed).toEqual(["/tmp/replay"]);
  });
});

describe("a hand-back runs the installed scribe against the checkout alone", () => {
  test("the scribe gets the hook input and an environment with no inherited scribe variable", async () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    await installedScribeGate({
      record: "260101-sample",
      gate: "rin-gate-2-plan-review",
      boundedClose: "off",
      installation: INSTALLATION,
      ports: checkout.ports,
    }).handBack({
      lens: "rin-stage-reviewer-agent",
      headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      message: "## Verdict\n\nNOT-READY\n",
    });
    expect(checkout.runs).toEqual([
      {
        scribe: "/repo/hooks/rin-gates-review-scribe.ts",
        environment: {
          ["PATH"]: "/bin",
          ["RIN_GATES_TEST_MODE"]: "1",
          ["RIN_GATES_SPACE"]: "default",
          ["RIN_GATES_HEAD_SHA"]: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          ["RIN_GATES_REVIEW_TRACE_PATH"]: "/tmp/replay/trace.jsonl",
          ["RIN_GATES_REVIEW_DISCARD_LEDGER_PATH"]: "/tmp/replay/discards.jsonl",
          ["RIN_GATES_REVIEW_HANDBACK_LEDGER_PATH"]:
            "/tmp/replay/handbacks.jsonl",
          ["RIN_GATES_REVIEW_CAPTURES_DIR"]: "/tmp/replay/captures",
          ["RIN_GATES_ENGINE_LOG_PATH"]: "/tmp/replay/engine-log.ts",
          ["RIN_GATES_ROSTER_CONFIG"]: "/repo/hooks/review-rosters.json",
          ["AIDLC_STAGE_GRAPH"]: "/repo/tools/data/stage-graph.json",
        },
        input:
          '{"agent_type":"rin-stage-reviewer-agent","agent_id":"rin-stage-reviewer-agent-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","last_assistant_message":"## Verdict\\n\\nNOT-READY\\n","cwd":"/tmp/replay","session_id":"review-history-replay"}',
      },
    ]);
  });

  test("a hand-back returns what the scribe said", async () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    expect(
      await installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).handBack({
        lens: "rin-stage-reviewer-agent",
        headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        message: "## Verdict\n\nNOT-READY\n",
      }),
    ).toBe("the scribe's diagnostics");
  });
});

describe("the gate reads back what the scribe wrote", () => {
  test("no verdict file reads as no verdict written", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).verdict(),
    ).toEqual({
      verdict: "NONE",
      headSha: "",
      findings: [],
      blockingFindings: [],
      lenses: [],
      isClosedByReceipt: false,
    });
  });

  test("a verdict the scribe wrote on its own reads as not closed by a receipt", () => {
    const checkout = fakeCheckout({
      seeded: new Map([
        [
          `${GATE_DIRECTORY}/review-verdict.json`,
          '{"verdict":"NOT-READY","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","findings":["a.md:1 | the quote | DD-1 | the defect"],"blockingFindings":["a.md:1 | the quote | DD-1 | the defect"],"lenses":["rin-stage-reviewer-agent"],"emittedBy":"rin-gates-review-scribe"}',
        ],
      ]),
    });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).verdict(),
    ).toEqual({
      verdict: "NOT-READY",
      headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      findings: ["a.md:1 | the quote | DD-1 | the defect"],
      blockingFindings: ["a.md:1 | the quote | DD-1 | the defect"],
      lenses: ["rin-stage-reviewer-agent"],
      isClosedByReceipt: false,
    });
  });

  test("a verdict that names a closing receipt reads as closed by it", () => {
    const checkout = fakeCheckout({
      seeded: new Map([
        [
          `${GATE_DIRECTORY}/review-verdict.json`,
          '{"verdict":"READY","headSha":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","findings":[],"blockingFindings":[],"lenses":["rin-stage-reviewer-agent"],"boundedClose":{"receipt":"review-close.json","attempt":1}}',
        ],
      ]),
    });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "all",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).verdict(),
    ).toEqual({
      verdict: "READY",
      headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      findings: [],
      blockingFindings: [],
      lenses: ["rin-stage-reviewer-agent"],
      isClosedByReceipt: true,
    });
  });

  test("no receipt file reads as no receipt", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).receipt(),
    ).toBeNull();
  });

  test("a receipt file reads as the decoded receipt", () => {
    const checkout = fakeCheckout({
      seeded: new Map([[`${GATE_DIRECTORY}/review-close.json`, "{}"]]),
    });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).receipt(),
    ).toEqual(FRAMING_RECEIPT);
  });

  test("no trace file reads as no trace", () => {
    const checkout = fakeCheckout({ seeded: INSTALLED_CONFIG });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).reviewTrace(),
    ).toBeUndefined();
  });

  test("a trace file reads as its text", () => {
    const checkout = fakeCheckout({
      seeded: new Map([["/tmp/replay/trace.jsonl", '{"stage":"entered"}\n']]),
    });
    expect(
      installedScribeGate({
        record: "260101-sample",
        gate: "rin-gate-2-plan-review",
        boundedClose: "off",
        installation: INSTALLATION,
        ports: checkout.ports,
      }).reviewTrace(),
    ).toBe('{"stage":"entered"}\n');
  });
});

describe("a replay against the installed scribe cleans up after itself", () => {
  test("it hands back the board and the close, reports the gate, and removes the checkout", async () => {
    const checkout = fakeCheckout({
      seeded: new Map([["/histories/sample.json", HISTORY_TEXT]]),
    });
    expect(
      await replayAgainstInstalledScribe({
        historyPath: "/histories/sample.json",
        boundedClose: "this-record",
        forwardGate: "rin-gate-3-interface-lock",
        installation: INSTALLATION,
        ports: checkout.ports,
      }),
    ).toEqual({
      kind: "left-open",
      verdict: "NONE",
      headSha: "",
      lensReports: 3,
    });
    expect(checkout.removed).toEqual(["/tmp/replay"]);
  });

  test("a history at a gate the pipeline does not have is refused before any checkout exists", async () => {
    const checkout = fakeCheckout({
      seeded: new Map([
        [
          "/histories/sample.json",
          '{"record":"260101-sample","gate":"rin-gate-9-unknown","roster":[],"rounds":[],"rows":[]}',
        ],
      ]),
    });
    await expect(
      replayAgainstInstalledScribe({
        historyPath: "/histories/sample.json",
        boundedClose: "off",
        forwardGate: "rin-gate-3-interface-lock",
        installation: INSTALLATION,
        ports: checkout.ports,
      }),
    ).rejects.toThrow();
    expect(checkout.created).toEqual([]);
  });
});
