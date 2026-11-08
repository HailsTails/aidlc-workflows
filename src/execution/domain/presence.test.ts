import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  CHAT,
  heardAt,
  OTHER_CHAT,
  stageOf,
  typedTurn,
  unitOf,
} from "../fixtures/workflow-record.fixture.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import type { AuditEvent } from "./audit.ts";
import type { Gate } from "./gate.ts";
import { CORE_GUARDS } from "./guard.ts";
import { auditSequence } from "./identities.ts";
import {
  gateOpening,
  personSinceFinished,
  presenceIn,
  type PresenceWindow,
} from "./presence.ts";
import type { RecordedApproval } from "./workflow-record.ts";

const OPENED = at("2026-11-08T10:00:00Z");
const DECIDED = at("2026-11-08T10:05:00Z");

const gateWindow: PresenceWindow = { session: CHAT, openedAt: OPENED, lastDecisionAt: null };
const afterDecision: PresenceWindow = { ...gateWindow, lastDecisionAt: DECIDED };

const stageGate: Gate = { kind: "stage", stage: stageOf("code-generation"), unit: null };
const planGate: Gate = {
  kind: "plan-approval",
  stage: stageOf("code-generation"),
  unit: unitOf("ledger"),
};

describe("presenceIn", () => {
  test("hears the latest turn typed in this chat since the gate opened", () => {
    expect(
      presenceIn(gateWindow, [
        typedTurn(at("2026-11-08T10:01:00Z")),
        typedTurn(at("2026-11-08T10:03:00Z")),
        typedTurn(at("2026-11-08T10:02:00Z")),
      ]),
    ).toEqual({ kind: "present", evidence: typedTurn(at("2026-11-08T10:03:00Z")) });
  });

  test("hears a turn typed in the same second the gate opened", () => {
    expect(presenceIn(gateWindow, [typedTurn(OPENED)])).toEqual({
      kind: "present",
      evidence: typedTurn(OPENED),
    });
  });

  test("does not hear a turn typed before the gate opened", () => {
    expect(presenceIn(gateWindow, [typedTurn(at("2026-11-08T09:59:59Z"))])).toEqual({
      kind: "absent",
      window: gateWindow,
    });
  });

  test("does not hear a turn typed in another chat", () => {
    expect(
      presenceIn(gateWindow, [{ ...typedTurn(at("2026-11-08T10:01:00Z")), session: OTHER_CHAT }]),
    ).toEqual({ kind: "absent", window: gateWindow });
  });

  test("does not hear a turn an earlier decision already spent, even in the same second", () => {
    expect(
      presenceIn(afterDecision, [typedTurn(at("2026-11-08T10:01:00Z")), typedTurn(DECIDED)]),
    ).toEqual({ kind: "absent", window: afterDecision });
  });
});

const openedEvent: AuditEvent = {
  intent: null,
  session: CHAT,
  at: OPENED,
  causedBy: null,
  sequence: accept(auditSequence(4)),
  fact: {
    kind: "transition",
    transition: {
      kind: "stage",
      stage: stageOf("code-generation"),
      unit: null,
      from: "in-progress",
      to: "awaiting-approval",
      cause: { kind: "engine-step" },
      at: OPENED,
    },
  },
};

const earlierDecision: RecordedApproval = {
  gate: { kind: "stage", stage: stageOf("requirements-analysis"), unit: null },
  decision: { kind: "approve" },
  decidedAt: DECIDED,
  basis: heardAt(OPENED),
  fingerprint: null,
  outcome: { kind: "applied" },
};

const unappliedDecision: RecordedApproval = {
  ...earlierDecision,
  decidedAt: at("2026-11-08T10:06:00Z"),
  outcome: {
    kind: "recorded-not-applied",
    refusal: {
      guard: CORE_GUARDS.stateTransition,
      reason: "This work is parked; that step needs it running.",
      nextStep: "Ask the engine for the next step and carry that out.",
    },
  },
};

describe("gateOpening", () => {
  test("opens a stage gate when its stage went to awaiting approval, after the last decision", () => {
    expect(
      gateOpening({
        gate: stageGate,
        session: CHAT,
        events: [openedEvent],
        approvals: [earlierDecision],
      }),
    ).toEqual({ kind: "opened", window: afterDecision });
  });

  test("a decision that was not applied leaves the person's turn unspent", () => {
    expect(
      gateOpening({
        gate: stageGate,
        session: CHAT,
        events: [openedEvent],
        approvals: [earlierDecision, unappliedDecision],
      }),
    ).toEqual({ kind: "opened", window: afterDecision });
  });

  test("a gate whose opening was never recorded stays unopened", () => {
    expect(gateOpening({ gate: planGate, session: CHAT, events: [openedEvent], approvals: [] })).toEqual(
      { kind: "unopened", gate: planGate },
    );
  });
});

describe("personSinceFinished", () => {
  test("the person spoke in this chat at or after the work finished", () => {
    expect(personSinceFinished({ session: CHAT, finishedAt: OPENED }, [typedTurn(OPENED)])).toBe(
      "spoke",
    );
  });

  test("the person stayed silent since the work finished", () => {
    expect(
      personSinceFinished({ session: CHAT, finishedAt: OPENED }, [
        typedTurn(at("2026-11-08T09:00:00Z")),
      ]),
    ).toBe("silent");
  });
});
