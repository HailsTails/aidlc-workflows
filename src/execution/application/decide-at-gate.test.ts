import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  fixedClock,
  guardsAsRecorded,
  knownPlan,
  memoryAuditLog,
  memoryRecordStore,
  recordedTurns,
} from "../fixtures/fakes.fixture.ts";
import { CHAT, heardAt, OTHER_CHAT, RUNNING_RECORD, stageOf, typedTurn } from "../fixtures/workflow-record.fixture.ts";
import type { AuditEvent } from "../domain/audit.ts";
import type { Gate } from "../domain/gate.ts";
import { CORE_GUARDS, type GuardSwitch } from "../domain/guard.ts";
import { auditSequence } from "../domain/identities.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { decideAtGateUseCase } from "./decide-at-gate.ts";

const OPENED = at("2026-11-08T10:00:00Z");
const NOW = at("2026-11-08T10:10:00Z");
const requirements = stageOf("requirements-analysis");
const requirementsGate: Gate = { kind: "stage", stage: requirements, unit: null };

const gateOpened: AuditEvent = {
  intent: RUNNING_RECORD.id,
  session: CHAT,
  at: OPENED,
  causedBy: null,
  sequence: accept(auditSequence(1)),
  fact: {
    kind: "transition",
    transition: {
      kind: "stage",
      stage: requirements,
      unit: null,
      from: "in-progress",
      to: "awaiting-approval",
      cause: { kind: "engine-step" },
      at: OPENED,
    },
  },
};

const approveRequirements = {
  intent: RUNNING_RECORD.id,
  gate: requirementsGate,
  decision: { kind: "approve" },
  session: CHAT,
} as const;

describe("DecideAtGate with the person's reply on record", () => {
  test("records the approval, saves the record and audits the moves it caused", async () => {
    const records = memoryRecordStore(RUNNING_RECORD);
    const audit = memoryAuditLog([gateOpened]);
    const useCase = decideAtGateUseCase({
      records,
      audit,
      clock: fixedClock(NOW),
      turns: recordedTurns([typedTurn(at("2026-11-08T10:05:00Z"))]),
      plans: knownPlan(null),
      environment: guardsAsRecorded,
    });

    expect(await useCase.decide(approveRequirements)).toMatchObject({
      ok: true,
      value: {
        version: 4,
        stages: [{}, { stage: requirements, progress: "completed" }, {}, {}, {}],
        approvals: [
          { gate: requirementsGate, basis: heardAt(at("2026-11-08T10:05:00Z")), outcome: { kind: "applied" } },
        ],
      },
    });
    expect(audit.events()).toMatchObject([
      gateOpened,
      { sequence: 2, causedBy: null, fact: { kind: "gate-decided" } },
      { sequence: 3, causedBy: 2, fact: { kind: "transition", transition: { to: "completed" } } },
    ]);
  });
});

describe("DecideAtGate without the person's reply", () => {
  test("stops on human presence when no turn was typed since the gate opened", async () => {
    const records = memoryRecordStore(RUNNING_RECORD);
    const audit = memoryAuditLog([gateOpened]);
    const useCase = decideAtGateUseCase({
      records,
      audit,
      clock: fixedClock(NOW),
      turns: recordedTurns([typedTurn(at("2026-11-08T09:55:00Z"))]),
      plans: knownPlan(null),
      environment: guardsAsRecorded,
    });

    expect(await useCase.decide(approveRequirements)).toEqual({
      ok: false,
      refusal: {
        kind: "guard",
        refusal: {
          guard: CORE_GUARDS.humanPresence,
          reason:
            "No reply the person typed has reached the requirements-analysis gate since it opened.",
          nextStep: "Wait for the person to type their choice, then record it.",
        },
      },
    });
    expect([records.stored(), audit.events().length]).toEqual([RUNNING_RECORD, 2]);
  });

  test("passes on a missing record", async () => {
    const useCase = decideAtGateUseCase({
      records: memoryRecordStore(null),
      audit: memoryAuditLog([]),
      clock: fixedClock(NOW),
      turns: recordedTurns([]),
      plans: knownPlan(null),
      environment: guardsAsRecorded,
    });

    expect(await useCase.decide(approveRequirements)).toEqual({
      ok: false,
      refusal: { kind: "record-not-found", intent: RUNNING_RECORD.id },
    });
  });
});

const deciding = (setup: {
  readonly record: WorkflowRecord;
  readonly events: readonly AuditEvent[];
}) => {
  const records = memoryRecordStore(setup.record);
  const audit = memoryAuditLog(setup.events);
  const useCase = decideAtGateUseCase({
    records,
    audit,
    clock: fixedClock(NOW),
    turns: recordedTurns([typedTurn(at("2026-11-08T10:05:00Z"))]),
    plans: knownPlan(null),
    environment: guardsAsRecorded,
  });
  return { records, audit, useCase };
};

describe("DecideAtGate on a gate never put to the person", () => {
  test("tells the agent to ask the engine, not to wait for a reply", async () => {
    const { useCase } = deciding({ record: RUNNING_RECORD, events: [] });

    expect(await useCase.decide(approveRequirements)).toMatchObject({
      ok: false,
      refusal: {
        refusal: {
          guard: CORE_GUARDS.humanPresence,
          reason: "Nothing has put the requirements-analysis gate to the person yet.",
        },
      },
    });
  });
});

const overrideOnce: GuardSwitch = {
  guard: CORE_GUARDS.humanPresence.id,
  state: "off",
  personWords: "approve it for me, I'm stepping out",
  at: at("2026-11-08T09:58:00Z"),
};

describe("DecideAtGate with human presence lifted", () => {
  test("records the decision on the person's override instead of a reply", async () => {
    const { useCase, audit } = deciding({
      record: { ...RUNNING_RECORD, guardSwitches: [overrideOnce] },
      events: [gateOpened],
    });
    const lifted = await useCase.decide({ ...approveRequirements, session: OTHER_CHAT });

    expect(lifted).toMatchObject({
      ok: true,
      value: { approvals: [{ basis: { kind: "presence-stood-aside", lift: overrideOnce } }] },
    });
    expect(audit.events()).toMatchObject([
      gateOpened,
      { fact: { kind: "guard-stood-aside", because: { kind: "switched-off", change: overrideOnce } } },
      { fact: { kind: "gate-decided" } },
      { fact: { kind: "transition" } },
    ]);
  });

  test("the override lifts the guard once only", async () => {
    const { useCase } = deciding({
      record: { ...RUNNING_RECORD, guardSwitches: [overrideOnce] },
      events: [gateOpened],
    });
    await useCase.decide({ ...approveRequirements, session: OTHER_CHAT });

    expect(
      await useCase.decide({ ...approveRequirements, decision: { kind: "skip" }, session: OTHER_CHAT }),
    ).toMatchObject({ ok: false, refusal: { refusal: { guard: CORE_GUARDS.humanPresence } } });
  });
});

describe("DecideAtGate when the record cannot take the decision", () => {
  test("keeps the person's decision as not applied, and refuses with the reason", async () => {
    const parked: WorkflowRecord = { ...RUNNING_RECORD, status: { kind: "parked", since: OPENED } };
    const { useCase, audit, records } = deciding({ record: parked, events: [gateOpened] });

    expect(await useCase.decide(approveRequirements)).toMatchObject({
      ok: false,
      refusal: { refusal: { reason: "This work is parked; that step needs it running." } },
    });
    expect(records.stored()).toMatchObject({
      stages: parked.stages,
      approvals: [{ decision: { kind: "approve" }, outcome: { kind: "recorded-not-applied" } }],
    });
    expect(audit.events()).toMatchObject([
      gateOpened,
      { sequence: 2, fact: { kind: "gate-decided" } },
      { sequence: 3, causedBy: 2, fact: { kind: "guard-refused" } },
    ]);
  });
});
