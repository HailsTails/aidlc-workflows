import { describe, expect, onTestFinished, test } from "vitest";
import type { CloseReceipt } from "../tools/rin-gates/rin-gates-bounded-close.ts";
import { defaultPathOperations } from "../tools/rin-harness-path-operations.ts";
import { defaultFileTextPort } from "../tools/rin-harness-sidecar-file-reader.ts";
import type { RosterResolution } from "./shared-review-roster.ts";
import { boundedCloseRefusal } from "./rin-gates-autonomy-gate.ts";

const paths = defaultPathOperations();
const files = defaultFileTextPort();
const join = (...segments: string[]): string => paths.join({ segments });

const FRAMING = "rin-gate-1-framing";
const RECORD = "260101-close";
const CLOSED_HEAD = "b".repeat(40);
const BOARD_ROSTER: RosterResolution = {
  kind: "resolved",
  roster: ["rin-stage-reviewer-agent", "rin-intent-defense-reviewer-agent"],
  source: "byGate",
};
const SINGLE_REVIEWER_ROSTER: RosterResolution = {
  kind: "resolved",
  roster: ["rin-stage-reviewer-agent"],
  source: "byGate",
};

const INVALIDATED_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: FRAMING,
  record: RECORD,
  attempt: 1,
  validity: {
    kind: "invalidated",
    reason: { kind: "seat-dispatch", agentType: "rin-architect-agent" },
    at: "2026-01-01T00:00:00.000Z",
  },
  closedBy: "clean-board",
  boardHeadSha: CLOSED_HEAD,
  closedHeadSha: CLOSED_HEAD,
  closedAt: "2026-01-01T00:00:00.000Z",
  carriedLenses: [],
  rows: [],
  rechecks: [],
  unadmitted: [],
  emittedBy: "rin-gates-review-scribe",
};

const STANDING_RECEIPT: CloseReceipt = {
  ...INVALIDATED_RECEIPT,
  validity: { kind: "standing" },
};

const checkoutWith = ({
  boundedClose,
  receipt,
}: {
  readonly boundedClose: "off" | "all" | { readonly records: readonly string[] };
  readonly receipt: CloseReceipt;
}): { readonly invokingCheckout: string; readonly recordDir: string } => {
  const invokingCheckout = files.makeTemporaryDirectory(
    join(files.temporaryRoot(), "rin-close-gate-"),
  );
  onTestFinished(() =>
    files.remove(invokingCheckout, { recursive: true, force: true }),
  );
  const recordDir = join(
    invokingCheckout,
    "aidlc",
    "spaces",
    "default",
    "intents",
    RECORD,
  );
  files.mkdir(join(recordDir, "inception", FRAMING), { recursive: true });
  files.write(
    join(recordDir, "inception", FRAMING, "review-close.json"),
    JSON.stringify(receipt),
  );
  files.write(
    join(invokingCheckout, "harness.config.json"),
    JSON.stringify({
      projectName: "ada",
      defaultScope: "rin-gates",
      rulesetRoot: "aidlc/spaces/default/memory",
      stageGraph: ".claude/tools/data/stage-graph.json",
      packageManager: { primary: "bun", runnerAllowlist: ["pnpm"] },
      rinGates: { oneBoardBoundedClose: boundedClose },
    }),
  );
  return { invokingCheckout, recordDir };
};

const UNCHANGED = {
  changedPathsSince: () => ({ outcome: "ok" as const, value: [] }),
};

const UNDERIVABLE = {
  changedPathsSince: () => ({
    outcome: "failed" as const,
    error: "bad revision",
  }),
};

const READY_ON_CLOSED_HEAD = { verdict: "READY", headSha: CLOSED_HEAD };

describe("the autonomy gate reads the closing receipt only under the flag", () => {
  test("with the flag off an invalidated receipt changes nothing", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({ boundedClose: "off", receipt: INVALIDATED_RECEIPT }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: BOARD_ROSTER,
        ports: UNCHANGED,
      }),
    ).toBeNull();
  });

  test("with the flag on for another record an invalidated receipt changes nothing", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({
          boundedClose: { records: ["260101-other"] },
          receipt: INVALIDATED_RECEIPT,
        }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: BOARD_ROSTER,
        ports: UNCHANGED,
      }),
    ).toBeNull();
  });

  test("with the flag on for this record an invalidated receipt refuses the approve", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({
          boundedClose: { records: [RECORD] },
          receipt: INVALIDATED_RECEIPT,
        }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: BOARD_ROSTER,
        ports: UNCHANGED,
      }),
    ).toContain("was invalidated");
  });

  test("with the flag on a standing receipt allows the approve", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({ boundedClose: "all", receipt: STANDING_RECEIPT }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: BOARD_ROSTER,
        ports: UNCHANGED,
      }),
    ).toBeNull();
  });

  test("a diff since the close that cannot be derived refuses the approve", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({ boundedClose: "all", receipt: STANDING_RECEIPT }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: BOARD_ROSTER,
        ports: UNDERIVABLE,
      }),
    ).toContain("could not derive what changed");
  });

  test("a gate whose roster has no closing lens is left to today's checks", () => {
    expect(
      boundedCloseRefusal({
        ...checkoutWith({ boundedClose: "all", receipt: INVALIDATED_RECEIPT }),
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        roster: SINGLE_REVIEWER_ROSTER,
        ports: UNCHANGED,
      }),
    ).toBeNull();
  });
});
