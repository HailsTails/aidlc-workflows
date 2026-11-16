import { describe, expect, test } from "vitest";
import type {
  AttemptLedgerEntry,
  CloseReceipt,
} from "../tools/rin-gates/rin-gates-bounded-close.ts";
import {
  boundedClosePolicyFor,
  boundedCloseStore,
  type BoundedCloseStorePorts,
  inboundRowsFor,
} from "./review-scribe-bounded-close.ts";
import type { RosterResolution } from "./shared-review-roster.ts";

const FRAMING = "rin-gate-1-framing";
const OPTIONS = "rin-gate-2-plan-review";
const RECORD_DIRECTORY = "/checkout/intents/260101-close";
const LEDGER_PATH =
  "/captures/attempts/260101-close.rin-gate-1-framing.attempt.jsonl";
const FRAMING_RECEIPT_PATH =
  "/checkout/intents/260101-close/inception/rin-gate-1-framing/review-close.json";

const SEAT_DISPATCH: AttemptLedgerEntry = {
  kind: "seat-dispatch",
  agentType: "rin-architect-agent",
  at: "2026-01-01T00:00:00.000Z",
};

const FORWARDING_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: FRAMING,
  record: "260101-close",
  attempt: 1,
  validity: { kind: "standing" },
  closedBy: "closing-ruling",
  boardHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  closedHeadSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [
    {
      id: "G1-R01",
      lens: "rin-stage-reviewer-agent",
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

const RECONCILE_FORWARDS_TO_FRAMING: CloseReceipt = {
  ...FORWARDING_RECEIPT,
  gate: "rin-gate-0-reconcile",
  rows: [
    {
      id: "G0-R01",
      lens: "rin-stage-reviewer-agent",
      text: "a.md:1 | the quote | DD-1 | the defect",
      origin: { kind: "raised" },
      outcome: { kind: "forwarded", toGate: FRAMING },
      note: "",
    },
  ],
};

type FakeStore = {
  readonly ports: BoundedCloseStorePorts;
  readonly madeDirectories: string[];
  readonly written: Map<string, string>;
  readonly appended: Map<string, string>;
};

const fakeStore = ({
  stored,
}: {
  readonly stored: ReadonlyMap<string, string>;
}): FakeStore => {
  const madeDirectories: string[] = [];
  const written = new Map<string, string>();
  const appended = new Map<string, string>();
  return {
    madeDirectories,
    written,
    appended,
    ports: {
      files: {
        exists: (path) => stored.has(path),
        read: (path) => String(stored.get(path)),
        write: (path, text) => {
          written.set(path, text);
        },
        append: (path, text) => {
          appended.set(path, text);
        },
        mkdir: (path) => {
          madeDirectories.push(path);
        },
      },
      decoders: {
        attemptLedgerEntry: () => ({ success: true, data: SEAT_DISPATCH }),
        closeReceipt: () => ({ success: true, data: FORWARDING_RECEIPT }),
      },
      join: (...segments) => segments.join("/"),
      dirname: () => "/the/parent/directory",
    },
  };
};

const NOTHING_STORED: ReadonlyMap<string, string> = new Map();

const BOARD_ROSTER: RosterResolution = {
  kind: "resolved",
  roster: ["rin-stage-reviewer-agent", "rin-intent-defense-reviewer-agent"],
  source: "byGate",
};
const SINGLE_REVIEWER_ROSTER: RosterResolution = {
  kind: "resolved",
  roster: ["rin-stage-reviewer-agent"],
  source: "defaultRoster",
};
const UNREADABLE_ROSTER: RosterResolution = {
  kind: "unreadable",
  reason: "no roster file",
};

describe("the attempt ledger lives beside the captures, one file per record and gate", () => {
  test("a ledger that was never written reads as no entries", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({ stored: NOTHING_STORED }).ports,
        capturesDirectory: "/captures",
      }).readLedger({ recordName: "260101-close", gate: FRAMING }),
    ).toEqual([]);
  });

  test("each non-empty line reads as one entry", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({
          stored: new Map([[LEDGER_PATH, '{"kind":"seat-dispatch"}\n\n']]),
        }).ports,
        capturesDirectory: "/captures",
      }).readLedger({ recordName: "260101-close", gate: FRAMING }),
    ).toEqual([SEAT_DISPATCH]);
  });

  test("a line that is not JSON is skipped", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({
          stored: new Map([[LEDGER_PATH, "not json\n"]]),
        }).ports,
        capturesDirectory: "/captures",
      }).readLedger({ recordName: "260101-close", gate: FRAMING }),
    ).toEqual([]);
  });

  test("an entry is appended as one line after its directory is made", () => {
    const store = fakeStore({ stored: NOTHING_STORED });
    boundedCloseStore({
      ports: store.ports,
      capturesDirectory: "/captures",
    }).appendLedger({
      recordName: "260101-close",
      gate: FRAMING,
      entry: SEAT_DISPATCH,
    });
    expect(store.madeDirectories).toEqual(["/the/parent/directory"]);
    expect(store.appended.get(LEDGER_PATH)).toBe(
      '{"kind":"seat-dispatch","agentType":"rin-architect-agent","at":"2026-01-01T00:00:00.000Z"}\n',
    );
  });
});

describe("the closing receipt lives in the gate's own record directory", () => {
  test("a gate with no receipt file reads as no receipt", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({ stored: NOTHING_STORED }).ports,
        capturesDirectory: "/captures",
      }).readReceipt({ recordDir: RECORD_DIRECTORY, gate: FRAMING }),
    ).toBeNull();
  });

  test("a receipt file reads as the decoded receipt", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({
          stored: new Map([[FRAMING_RECEIPT_PATH, "{}"]]),
        }).ports,
        capturesDirectory: "/captures",
      }).readReceipt({ recordDir: RECORD_DIRECTORY, gate: FRAMING }),
    ).toEqual(FORWARDING_RECEIPT);
  });

  test("a receipt file that is not JSON reads as no receipt", () => {
    expect(
      boundedCloseStore({
        ports: fakeStore({
          stored: new Map([[FRAMING_RECEIPT_PATH, "not json"]]),
        }).ports,
        capturesDirectory: "/captures",
      }).readReceipt({ recordDir: RECORD_DIRECTORY, gate: FRAMING }),
    ).toBeNull();
  });

  test("a receipt is written to the directory of the gate it names", () => {
    const store = fakeStore({ stored: NOTHING_STORED });
    boundedCloseStore({
      ports: store.ports,
      capturesDirectory: "/captures",
    }).writeReceipt({
      recordDir: RECORD_DIRECTORY,
      receipt: FORWARDING_RECEIPT,
    });
    expect(store.madeDirectories).toEqual(["/the/parent/directory"]);
    expect(store.written.has(FRAMING_RECEIPT_PATH)).toBe(true);
  });
});

describe("a gate takes in the rows earlier gates forwarded to it", () => {
  test("the gate a row was forwarded to receives it", () => {
    expect(
      inboundRowsFor({
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        store: { readReceipt: () => RECONCILE_FORWARDS_TO_FRAMING },
      }),
    ).toEqual([
      {
        id: "G0-R01",
        lens: "rin-stage-reviewer-agent",
        text: "a.md:1 | the quote | DD-1 | the defect",
        origin: { kind: "forwarded", fromGate: "rin-gate-0-reconcile" },
      },
    ]);
  });

  test("a gate with no earlier receipts receives nothing", () => {
    expect(
      inboundRowsFor({
        gate: OPTIONS,
        recordDir: RECORD_DIRECTORY,
        store: { readReceipt: () => null },
      }),
    ).toEqual([]);
  });
});

describe("the bounded close applies only where a gate has a closing lens", () => {
  test("a gate whose roster includes the closing lens gets a policy naming the later gates that can take a forward", () => {
    expect(
      boundedClosePolicyFor({
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        rosterFor: () => BOARD_ROSTER,
        store: { readReceipt: () => null },
        exceptionWhyChainsEnabled: true,
      }),
    ).toEqual({
      gate: "rin-gate-1-framing",
      roster: ["rin-stage-reviewer-agent", "rin-intent-defense-reviewer-agent"],
      inboundRows: [],
      forwardableGates: [
        "rin-gate-2-plan-review",
        "rin-gate-3-interface-lock",
        "rin-gate-4-implement",
        "rin-gate-5-review-cycle",
        "rin-gate-6-operate",
      ],
      exceptionWhyChainsEnabled: true,
    });
  });

  test("a gate whose roster has no closing lens gets none", () => {
    expect(
      boundedClosePolicyFor({
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        rosterFor: () => SINGLE_REVIEWER_ROSTER,
        store: { readReceipt: () => null },
        exceptionWhyChainsEnabled: true,
      }),
    ).toBeNull();
  });

  test("a gate whose roster cannot be read gets none", () => {
    expect(
      boundedClosePolicyFor({
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        rosterFor: () => UNREADABLE_ROSTER,
        store: { readReceipt: () => null },
        exceptionWhyChainsEnabled: true,
      }),
    ).toBeNull();
  });

  test("a stage that is not a rin gate gets none", () => {
    expect(
      boundedClosePolicyFor({
        gate: "code-generation",
        recordDir: RECORD_DIRECTORY,
        rosterFor: () => BOARD_ROSTER,
        store: { readReceipt: () => null },
        exceptionWhyChainsEnabled: true,
      }),
    ).toBeNull();
  });
});
