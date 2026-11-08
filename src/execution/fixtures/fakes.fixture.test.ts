import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { recordVersion } from "../domain/identities.ts";
import {
  fixedClock,
  knownPlan,
  memoryAuditLog,
  memoryRecordStore,
  recordedTurns,
} from "./fakes.fixture.ts";
import {
  CHAT,
  OTHER_CHAT,
  RUNNING_RECORD,
  stageOf,
  typedTurn,
  unitOf,
} from "./workflow-record.fixture.ts";

describe("memoryRecordStore", () => {
  test("saves at the expected version and moves the version on", async () => {
    const store = memoryRecordStore(RUNNING_RECORD);

    expect(await store.save({ record: RUNNING_RECORD, expected: RUNNING_RECORD.version })).toEqual({
      ok: true,
      value: { ...RUNNING_RECORD, version: accept(recordVersion(4)) },
    });
  });

  test("refuses a save from a stale version", async () => {
    const store = memoryRecordStore({ ...RUNNING_RECORD });
    await store.save({ record: RUNNING_RECORD, expected: RUNNING_RECORD.version });

    expect(await store.save({ record: RUNNING_RECORD, expected: RUNNING_RECORD.version })).toEqual({
      ok: false,
      refusal: {
        kind: "record-changed",
        intent: RUNNING_RECORD.id,
        expected: accept(recordVersion(3)),
        found: accept(recordVersion(4)),
      },
    });
  });
});

describe("memoryAuditLog", () => {
  test("numbers entries in the order they arrive", async () => {
    const log = memoryAuditLog([]);
    const entry = {
      intent: RUNNING_RECORD.id,
      session: CHAT,
      at: at("2026-11-08T10:00:00Z"),
      causedBy: null,
      fact: { kind: "host-event", point: "stop" },
    } as const;

    expect([(await log.append(entry)).sequence, (await log.append(entry)).sequence]).toEqual<
      readonly number[]
    >([1, 2]);
  });
});

describe("other fakes", () => {
  test("recordedTurns answers this chat's turns from a time on", async () => {
    const turns = recordedTurns([
      typedTurn(at("2026-11-08T09:00:00Z")),
      typedTurn(at("2026-11-08T10:00:00Z")),
      { ...typedTurn(at("2026-11-08T10:00:00Z")), session: OTHER_CHAT },
    ]);

    expect(await turns.humanTurnsSince({ session: CHAT, from: at("2026-11-08T10:00:00Z") })).toEqual([
      typedTurn(at("2026-11-08T10:00:00Z")),
    ]);
  });

  test("the clock answers the time it was given", () => {
    expect(fixedClock(at("2026-11-08T10:00:00Z")).now()).toBe(at("2026-11-08T10:00:00Z"));
  });

  test("the plan answers the fingerprint it was given", async () => {
    expect(
      await knownPlan(null).current({
        intent: RUNNING_RECORD.id,
        stage: stageOf("code-generation"),
        unit: unitOf("ledger"),
      }),
    ).toBeNull();
  });
});
