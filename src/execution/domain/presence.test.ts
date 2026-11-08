import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  CHAT,
  OTHER_CHAT,
  stageOf,
  typedTurn,
  unitOf,
} from "../fixtures/workflow-record.fixture.ts";
import type { Gate } from "./gate.ts";
import {
  personSinceFinished,
  presenceIn,
  presenceRequirement,
  type PresenceWindow,
} from "./presence.ts";

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

describe("presenceRequirement", () => {
  test.each([
    { gate: stageGate, phase: "construction", autonomy: "autonomous", needs: "engine-may-decide" },
    { gate: stageGate, phase: "construction", autonomy: "gated", needs: "person-decides" },
    { gate: stageGate, phase: "inception", autonomy: "autonomous", needs: "person-decides" },
    { gate: planGate, phase: "construction", autonomy: "autonomous", needs: "person-decides" },
  ] as const)(
    "a $gate.kind gate in $phase under $autonomy autonomy: $needs",
    ({ gate, phase, autonomy, needs }) => {
      expect(presenceRequirement({ gate, phase, autonomy })).toBe(needs);
    },
  );
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
