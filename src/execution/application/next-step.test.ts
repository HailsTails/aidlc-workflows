import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import {
  artifactsUnder,
  fixedClock,
  installedMethod,
  memoryAuditLog,
  memoryRecordStore,
} from "../fixtures/fakes.fixture.ts";
import { RUNNING_RECORD, stageOf } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS } from "../domain/guard.ts";
import type { StageState, WorkflowRecord } from "../domain/workflow-record.ts";
import { nextStepUseCase, type NextStepDependencies } from "./next-step.ts";

const NOW = at("2026-11-08T10:00:00Z");
const requirements = stageOf("requirements-analysis");

const withStages = (stages: readonly StageState[]): WorkflowRecord => ({ ...RUNNING_RECORD, stages });

const engineOver = (record: WorkflowRecord): NextStepDependencies => ({
  records: memoryRecordStore(record),
  audit: memoryAuditLog([]),
  clock: fixedClock(NOW),
  methods: installedMethod(methodSliceFixture),
  artifacts: artifactsUnder("aidlc/spaces/default/intents"),
});

const request = { intent: RUNNING_RECORD.id };

describe("NextStep moving the work on", () => {
  test("starts a pending stage, saves and audits that, then tells the conductor to run it", async () => {
    const engine = engineOver(withStages([{ stage: requirements, unit: null, progress: "pending" }]));

    expect(await nextStepUseCase(engine).next(request)).toMatchObject({
      ok: true,
      value: {
        kind: "run-stage",
        stage: requirements,
        unit: null,
        lead: "aidlc-product-agent",
        produces: [
          {
            artifact: "requirements",
            path: "aidlc/spaces/default/intents/checkout-flow/intent/requirements.md",
          },
          {
            artifact: "requirements-analysis-questions",
            path: "aidlc/spaces/default/intents/checkout-flow/intent/requirements-analysis-questions.md",
          },
          {
            artifact: "traceability",
            path: "aidlc/spaces/default/intents/checkout-flow/intent/traceability.md",
          },
        ],
      },
    });
    await expect(engine.audit.since({ intent: RUNNING_RECORD.id, after: null })).resolves.toMatchObject([
      { fact: { kind: "transition", transition: { to: "in-progress" } } },
    ]);
  });

  test("completes work whose stages are all finished", async () => {
    const engine = engineOver(withStages([{ stage: requirements, unit: null, progress: "completed" }]));

    expect(await nextStepUseCase(engine).next(request)).toEqual({
      ok: true,
      value: { kind: "finished" },
    });
  });
});

describe("NextStep at a stage awaiting approval", () => {
  test("asks for the review first and audits the request", async () => {
    const engine = engineOver(
      withStages([{ stage: requirements, unit: null, progress: "awaiting-approval" }]),
    );

    expect(await nextStepUseCase(engine).next(request)).toMatchObject({
      ok: true,
      value: { kind: "request-review", attempt: { stage: requirements, iteration: 1 } },
    });
    await expect(engine.audit.since({ intent: RUNNING_RECORD.id, after: null })).resolves.toMatchObject([
      { fact: { kind: "review-requested" } },
    ]);
  });

  test("puts the gate to the person in plain words when there is no review", async () => {
    const engine = engineOver({
      ...withStages([{ stage: requirements, unit: null, progress: "awaiting-approval" }]),
      settings: { ...RUNNING_RECORD.settings, reviewOverride: "none" },
    });

    expect(await nextStepUseCase(engine).next(request)).toMatchObject({
      ok: true,
      value: {
        kind: "ask-person",
        gate: { kind: "stage", stage: requirements, unit: null },
        question: "Requirements Analysis is ready for your decision. How would you like to go on?",
      },
    });
  });
});

describe("NextStep on parked work", () => {
  test("tells the conductor the work is parked, as a state-transition stop", async () => {
    const engine = engineOver({ ...RUNNING_RECORD, status: { kind: "parked", since: NOW } });

    expect(await nextStepUseCase(engine).next(request)).toMatchObject({
      ok: true,
      value: {
        kind: "refused",
        refusal: {
          guard: CORE_GUARDS.stateTransition,
          reason: "This work is parked; that step needs it running.",
        },
      },
    });
  });
});
