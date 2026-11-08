import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  fixedClock,
  knownPlan,
  memoryAuditLog,
  memoryRecordStore,
  recordedTurns,
} from "../fixtures/fakes.fixture.ts";
import { CHAT, RUNNING_RECORD, stageOf, typedTurn } from "../fixtures/workflow-record.fixture.ts";
import type { AuditEvent } from "../domain/audit.ts";
import type { Gate } from "../domain/gate.ts";
import { CORE_GUARDS } from "../domain/guard.ts";
import { auditSequence } from "../domain/identities.ts";
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
    });

    expect(await useCase.decide(approveRequirements)).toMatchObject({
      ok: true,
      value: {
        version: 4,
        stages: [{}, { stage: requirements, progress: "completed" }, {}, {}, {}],
        approvals: [{ gate: requirementsGate, evidence: typedTurn(at("2026-11-08T10:05:00Z")) }],
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
    });

    expect(await useCase.decide(approveRequirements)).toEqual({
      ok: false,
      refusal: { kind: "record-not-found", intent: RUNNING_RECORD.id },
    });
  });
});
