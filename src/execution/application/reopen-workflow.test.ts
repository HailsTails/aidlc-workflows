import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import {
  fixedClock,
  memoryAuditLog,
  memoryRecordStore,
  recordedTurns,
} from "../fixtures/fakes.fixture.ts";
import { CHAT, RUNNING_RECORD, typedTurn } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS } from "../domain/guard.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { reopenWorkflowUseCase } from "./reopen-workflow.ts";

const FINISHED = at("2026-11-08T09:00:00Z");
const NOW = at("2026-11-08T10:00:00Z");

const finished: WorkflowRecord = {
  ...RUNNING_RECORD,
  status: { kind: "completed", at: FINISHED },
};

const reopenRequest = { intent: RUNNING_RECORD.id, session: CHAT };

describe("ReopenWorkflow", () => {
  test("reopens finished work the person asked about in this chat, and audits it", async () => {
    const audit = memoryAuditLog([]);
    const useCase = reopenWorkflowUseCase({
      records: memoryRecordStore(finished),
      audit,
      clock: fixedClock(NOW),
      turns: recordedTurns([typedTurn(at("2026-11-08T09:30:00Z"))]),
    });

    expect(await useCase.reopen(reopenRequest)).toMatchObject({
      ok: true,
      value: { status: { kind: "running" }, version: 4 },
    });
    expect(audit.events()).toMatchObject([
      { fact: { kind: "transition", transition: { kind: "reopen", personSinceFinished: "spoke" } } },
    ]);
  });

  test("stops on human presence when the person has not spoken since it finished", async () => {
    const useCase = reopenWorkflowUseCase({
      records: memoryRecordStore(finished),
      audit: memoryAuditLog([]),
      clock: fixedClock(NOW),
      turns: recordedTurns([typedTurn(at("2026-11-08T08:00:00Z"))]),
    });

    expect(await useCase.reopen(reopenRequest)).toMatchObject({
      ok: false,
      refusal: { kind: "guard", refusal: { guard: CORE_GUARDS.humanPresence } },
    });
  });

  test("refuses to reopen work that is still running", async () => {
    const useCase = reopenWorkflowUseCase({
      records: memoryRecordStore(RUNNING_RECORD),
      audit: memoryAuditLog([]),
      clock: fixedClock(NOW),
      turns: recordedTurns([]),
    });

    expect(await useCase.reopen(reopenRequest)).toMatchObject({
      ok: false,
      refusal: {
        kind: "guard",
        refusal: {
          guard: CORE_GUARDS.stateTransition,
          reason: "This work is running; that step needs it completed.",
        },
      },
    });
  });
});
