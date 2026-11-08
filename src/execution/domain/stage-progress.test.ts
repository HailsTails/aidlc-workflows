import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { RUNNING_RECORD, stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import { jumpToStage, moveStage } from "./stage-progress.ts";
import type { Transition, TransitionCause } from "./transition.ts";
import type { WorkflowRecord } from "./workflow-record.ts";

const NOW = at("2026-11-08T10:00:00Z");
const ENGINE: TransitionCause = { kind: "engine-step" };
const APPROVED: TransitionCause = { kind: "person-decision", decision: { kind: "approve" } };

const detection = stageOf("workspace-detection");
const requirements = stageOf("requirements-analysis");
const design = stageOf("application-design");
const generation = stageOf("code-generation");
const testing = stageOf("build-and-test");
const payments = unitOf("payments-api");
const ledger = unitOf("ledger");

const JUMPED_AHEAD: TransitionCause = {
  kind: "person-decision",
  decision: { kind: "jump", to: generation },
};
const JUMPED_BACK: TransitionCause = {
  kind: "person-decision",
  decision: { kind: "jump", to: requirements },
};

const record = RUNNING_RECORD;

const laterRecord: WorkflowRecord = {
  ...record,
  stages: [
    { stage: detection, unit: null, progress: "completed" },
    { stage: requirements, unit: null, progress: "completed" },
    { stage: design, unit: null, progress: "skipped" },
    { stage: generation, unit: payments, progress: "completed" },
    { stage: generation, unit: ledger, progress: "in-progress" },
  ],
};

const approvedTransition: Transition = {
  kind: "stage",
  stage: requirements,
  unit: null,
  from: "awaiting-approval",
  to: "completed",
  cause: APPROVED,
  at: NOW,
};

const ledgerStarted: Transition = {
  kind: "stage",
  stage: generation,
  unit: ledger,
  from: "pending",
  to: "in-progress",
  cause: ENGINE,
  at: NOW,
};

describe("moveStage on running work", () => {
  test("approves a stage awaiting approval and records the person's decision", () => {
    expect(
      moveStage(record, {
        at: { stage: requirements, unit: null },
        move: "approve",
        cause: APPROVED,
        time: NOW,
      }),
    ).toEqual({
      ok: true,
      value: {
        record: {
          ...record,
          stages: [
            { stage: detection, unit: null, progress: "completed" },
            { stage: requirements, unit: null, progress: "completed" },
            { stage: design, unit: null, progress: "pending" },
            { stage: generation, unit: payments, progress: "pending" },
            { stage: generation, unit: ledger, progress: "pending" },
          ],
        },
        transitions: [approvedTransition],
      },
    });
  });

  test("starts one Unit's stage and leaves the other Unit pending", () => {
    expect(
      moveStage(record, {
        at: { stage: generation, unit: ledger },
        move: "start",
        cause: ENGINE,
        time: NOW,
      }),
    ).toEqual({
      ok: true,
      value: {
        record: {
          ...record,
          stages: [
            { stage: detection, unit: null, progress: "completed" },
            { stage: requirements, unit: null, progress: "awaiting-approval" },
            { stage: design, unit: null, progress: "pending" },
            { stage: generation, unit: payments, progress: "pending" },
            { stage: generation, unit: ledger, progress: "in-progress" },
          ],
        },
        transitions: [ledgerStarted],
      },
    });
  });
});

describe("moveStage refusals", () => {
  test("refuses to submit a stage that has not started and names where it may come from", () => {
    expect(
      moveStage(record, {
        at: { stage: design, unit: null },
        move: "submit",
        cause: ENGINE,
        time: NOW,
      }),
    ).toEqual({
      ok: false,
      refusal: {
        kind: "stage-out-of-order",
        at: { stage: design, unit: null, progress: "pending" },
        allowedFrom: ["in-progress", "revising"],
      },
    });
  });

  test("refuses a stage this work does not run", () => {
    expect(
      moveStage(record, {
        at: { stage: generation, unit: null },
        move: "start",
        cause: ENGINE,
        time: NOW,
      }),
    ).toEqual({ ok: false, refusal: { kind: "stage-not-in-plan", stage: generation, unit: null } });
  });

  test("refuses to move a stage while the work is parked", () => {
    expect(
      moveStage(
        { ...record, status: { kind: "parked", since: NOW } },
        { at: { stage: requirements, unit: null }, move: "approve", cause: APPROVED, time: NOW },
      ),
    ).toEqual({
      ok: false,
      refusal: { kind: "workflow-status", status: { kind: "parked", since: NOW }, needed: "running" },
    });
  });
});

describe("jumpToStage forward", () => {
  test("skips the work it passes over, the current stage included, and starts the target", () => {
    expect(jumpToStage(record, { to: generation, cause: JUMPED_AHEAD, time: NOW })).toEqual({
      ok: true,
      value: {
        record: {
          ...record,
          stages: [
            { stage: detection, unit: null, progress: "completed" },
            { stage: requirements, unit: null, progress: "skipped" },
            { stage: design, unit: null, progress: "skipped" },
            { stage: generation, unit: payments, progress: "in-progress" },
            { stage: generation, unit: ledger, progress: "pending" },
          ],
        },
        transitions: [
          { ...approvedTransition, to: "skipped", cause: JUMPED_AHEAD },
          { ...approvedTransition, stage: design, from: "pending", to: "skipped", cause: JUMPED_AHEAD },
          { ...ledgerStarted, unit: payments, cause: JUMPED_AHEAD },
        ],
      },
    });
  });

  test("refuses a jump to a stage this work does not run", () => {
    expect(jumpToStage(record, { to: testing, cause: JUMPED_AHEAD, time: NOW })).toEqual({
      ok: false,
      refusal: { kind: "stage-not-in-plan", stage: testing, unit: null },
    });
  });
});

describe("jumpToStage backward", () => {
  test("starts the target again and resets every later stage", () => {
    expect(jumpToStage(laterRecord, { to: requirements, cause: JUMPED_BACK, time: NOW })).toEqual({
      ok: true,
      value: {
        record: {
          ...laterRecord,
          stages: [
            { stage: detection, unit: null, progress: "completed" },
            { stage: requirements, unit: null, progress: "in-progress" },
            { stage: design, unit: null, progress: "pending" },
            { stage: generation, unit: payments, progress: "pending" },
            { stage: generation, unit: ledger, progress: "pending" },
          ],
        },
        transitions: [
          { ...approvedTransition, from: "completed", to: "in-progress", cause: JUMPED_BACK },
          { ...approvedTransition, stage: design, from: "skipped", to: "pending", cause: JUMPED_BACK },
          { ...ledgerStarted, unit: payments, from: "completed", to: "pending", cause: JUMPED_BACK },
          { ...ledgerStarted, from: "in-progress", to: "pending", cause: JUMPED_BACK },
        ],
      },
    });
  });
});
