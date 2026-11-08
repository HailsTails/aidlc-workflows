import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { guardsAsRecorded, memoryAuditLog } from "../fixtures/fakes.fixture.ts";
import { CHAT, RUNNING_RECORD } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS, type GuardRefusal, type GuardSwitch } from "../domain/guard.ts";
import { heldRefusal, stopRaiser } from "./raise-stop.ts";

const NOW = at("2026-11-08T10:00:00Z");
const scene = { intent: RUNNING_RECORD.id, session: CHAT, at: NOW };

const noReply: GuardRefusal = {
  guard: CORE_GUARDS.humanPresence,
  reason: "No reply the person typed has reached the requirements-analysis gate since it opened.",
  nextStep: "Wait for the person to type their choice, then record it.",
};

const override: GuardSwitch = {
  guard: CORE_GUARDS.humanPresence.id,
  state: "off",
  personWords: "decide it for me this once",
  at: at("2026-11-08T09:50:00Z"),
};

describe("stopRaiser", () => {
  test("a guard that holds is audited as a refusal", async () => {
    const audit = memoryAuditLog([]);
    const raise = stopRaiser({ audit, environment: guardsAsRecorded });

    expect(await raise({ refusal: noReply, record: RUNNING_RECORD, scene, after: null })).toEqual({
      kind: "holds",
      refusal: noReply,
    });
    expect(audit.events()).toMatchObject([{ ...scene, causedBy: null, fact: { kind: "guard-refused" } }]);
  });

  test("the person's override stands the guard aside once, and the audit spends it", async () => {
    const audit = memoryAuditLog([]);
    const raise = stopRaiser({ audit, environment: guardsAsRecorded });
    const overridden = { ...RUNNING_RECORD, guardSwitches: [override] };

    expect(await raise({ refusal: noReply, record: overridden, scene, after: null })).toEqual({
      kind: "stands-aside",
      guard: CORE_GUARDS.humanPresence,
      because: { kind: "switched-off", change: override },
    });
    expect(await raise({ refusal: noReply, record: overridden, scene, after: null })).toMatchObject({
      kind: "holds",
    });
  });

  test("records the verdict as an effect of the event that caused it", async () => {
    const audit = memoryAuditLog([]);
    const observed = await audit.append({ ...scene, causedBy: null, fact: { kind: "host-event", point: "stop" } });

    await stopRaiser({ audit, environment: guardsAsRecorded })({
      refusal: noReply,
      record: RUNNING_RECORD,
      scene,
      after: observed,
    });

    expect(audit.events()).toMatchObject([{ sequence: 1 }, { sequence: 2, causedBy: 1 }]);
  });
});

describe("heldRefusal", () => {
  test("is the refusal the guard held with", () => {
    expect(heldRefusal({ kind: "holds", refusal: noReply }, noReply)).toEqual(noReply);
  });

  test("falls back to the raised refusal when nothing held", () => {
    expect(
      heldRefusal(
        { kind: "stands-aside", guard: CORE_GUARDS.humanPresence, because: { kind: "switched-off", change: override } },
        noReply,
      ),
    ).toEqual(noReply);
  });
});
