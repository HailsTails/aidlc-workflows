import { describe, expect, test } from "vitest";
import type { CloseReceipt } from "../tools/rin-gates/rin-gates-bounded-close.ts";
import {
  type BoundedCloseGatePorts,
  boundedCloseRefusal,
} from "./rin-gates-autonomy-gate.ts";
import type { RosterResolution } from "./shared-review-roster.ts";

const FRAMING = "rin-gate-1-framing";
const RECORD_DIRECTORY = "/checkout/aidlc/spaces/default/intents/260101-close";
const REQUIREMENTS =
  "aidlc/spaces/default/intents/260101-close/inception/rin-gate-1-framing/rin-requirements.md";
const CLOSED_HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
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

const STANDING_RECEIPT: CloseReceipt = {
  schemaVersion: 1,
  gate: FRAMING,
  record: "260101-close",
  attempt: 1,
  validity: { kind: "standing" },
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

const INVALIDATED_RECEIPT: CloseReceipt = {
  ...STANDING_RECEIPT,
  validity: {
    kind: "invalidated",
    reason: { kind: "seat-dispatch", agentType: "rin-architect-agent" },
    at: "2026-01-01T00:00:00.000Z",
  },
};

const FLAG_ON_WITH_A_STANDING_RECEIPT: BoundedCloseGatePorts = {
  changedPathsSince: () => ({ outcome: "ok", value: [] }),
  isBoundedCloseOnFor: () => true,
  readReceipt: () => STANDING_RECEIPT,
  reviewedArtifactPathsOf: () => [REQUIREMENTS],
};

const FLAG_ON_WITH_AN_INVALIDATED_RECEIPT: BoundedCloseGatePorts = {
  ...FLAG_ON_WITH_A_STANDING_RECEIPT,
  readReceipt: () => INVALIDATED_RECEIPT,
};

const FLAG_OFF_WITH_AN_INVALIDATED_RECEIPT: BoundedCloseGatePorts = {
  ...FLAG_ON_WITH_AN_INVALIDATED_RECEIPT,
  isBoundedCloseOnFor: () => false,
};

const FLAG_ON_WITH_AN_UNDERIVABLE_DIFF: BoundedCloseGatePorts = {
  ...FLAG_ON_WITH_A_STANDING_RECEIPT,
  changedPathsSince: () => ({ outcome: "failed", error: "bad revision" }),
};

const FLAG_ON_WITH_A_REVIEWED_ARTEFACT_EDITED: BoundedCloseGatePorts = {
  ...FLAG_ON_WITH_A_STANDING_RECEIPT,
  changedPathsSince: () => ({ outcome: "ok", value: [REQUIREMENTS] }),
};

const READY_ON_CLOSED_HEAD = {
  verdict: "READY",
  headSha: CLOSED_HEAD,
  boundedClose: { receipt: "review-close.json" },
};

describe("the autonomy gate reads the closing receipt only under the flag", () => {
  test("with the flag off for the record an invalidated receipt changes nothing", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_OFF_WITH_AN_INVALIDATED_RECEIPT,
      }),
    ).toBeNull();
  });

  test("with the flag on for the record an invalidated receipt refuses the approve", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_ON_WITH_AN_INVALIDATED_RECEIPT,
      }),
    ).toContain("was invalidated");
  });

  test("with the flag on a standing receipt and untouched artefacts allow the approve", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_ON_WITH_A_STANDING_RECEIPT,
      }),
    ).toBeNull();
  });

  test("a reviewed artefact edited since the close refuses the approve", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_ON_WITH_A_REVIEWED_ARTEFACT_EDITED,
      }),
    ).toContain("was edited after 'rin-gate-1-framing' closed");
  });

  test("a diff since the close that cannot be derived refuses the approve", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_ON_WITH_AN_UNDERIVABLE_DIFF,
      }),
    ).toContain("could not derive what changed");
  });

  test("a gate whose roster has no closing lens is left to today's checks", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: FRAMING,
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: SINGLE_REVIEWER_ROSTER,
        ports: FLAG_ON_WITH_AN_INVALIDATED_RECEIPT,
      }),
    ).toBeNull();
  });

  test("a stage that is not a rin gate is left to today's checks", () => {
    expect(
      boundedCloseRefusal({
        verdict: READY_ON_CLOSED_HEAD,
        gate: "code-generation",
        recordDir: RECORD_DIRECTORY,
        invokingCheckout: "/checkout",
        roster: BOARD_ROSTER,
        ports: FLAG_ON_WITH_AN_INVALIDATED_RECEIPT,
      }),
    ).toBeNull();
  });
});
