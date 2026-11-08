import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import { intentId, intentSlug, recordVersion, spaceName } from "./identities.ts";
import {
  completeWorkflow,
  parkWorkflow,
  progressFinished,
  reopenWorkflow,
  resumeWorkflow,
  type StageState,
  type WorkflowRecord,
} from "./workflow-record.ts";

const NOW = at("2026-11-08T10:00:00Z");
const EARLIER = at("2026-11-08T09:00:00Z");

const requirements = accept(stageSlug("requirements-analysis"));
const design = accept(stageSlug("application-design"));

const finishedStages: readonly StageState[] = [
  { stage: requirements, unit: null, progress: "completed" },
  { stage: design, unit: null, progress: "skipped" },
];

const runningRecord: WorkflowRecord = {
  id: accept(intentId("261108-checkout-flow")),
  slug: accept(intentSlug("checkout-flow")),
  space: accept(spaceName("default")),
  scope: accept(scopeName("feature")),
  version: accept(recordVersion(3)),
  status: { kind: "running" },
  settings: {
    depth: "standard",
    guardPolicy: "strict",
    ceremony: {
      sensors: "on",
      learnings: "on",
      "summary-confirmation": "on",
      "plan-approval": "on",
      collaborators: "on",
    },
    reviewOverride: null,
  },
  stages: [
    { stage: requirements, unit: null, progress: "completed" },
    { stage: design, unit: null, progress: "in-progress" },
  ],
  units: null,
  checkpoints: [],
  blockingChecks: [],
  approvals: [],
  reviews: [],
  guardSwitches: [],
};

const parkedRecord: WorkflowRecord = { ...runningRecord, status: { kind: "parked", since: EARLIER } };

const finishedRecord: WorkflowRecord = {
  ...runningRecord,
  stages: finishedStages,
  status: { kind: "completed", at: EARLIER },
};

describe("progressFinished", () => {
  test.each([
    { progress: "completed", reading: "finished" },
    { progress: "skipped", reading: "finished" },
    { progress: "pending", reading: "unfinished" },
    { progress: "awaiting-approval", reading: "unfinished" },
  ] as const)("reads $progress as $reading", ({ progress, reading }) => {
    expect(progressFinished(progress)).toBe(reading);
  });
});

describe("parkWorkflow", () => {
  test("parks running work and records when", () => {
    expect(parkWorkflow(runningRecord, NOW)).toEqual({
      ok: true,
      value: {
        record: { ...runningRecord, status: { kind: "parked", since: NOW } },
        transitions: [{ kind: "park", at: NOW }],
      },
    });
  });

  test("refuses to park work that is already parked", () => {
    expect(parkWorkflow(parkedRecord, NOW)).toEqual({
      ok: false,
      refusal: { kind: "workflow-status", status: parkedRecord.status, needed: "running" },
    });
  });
});

describe("resumeWorkflow", () => {
  test("resumes parked work", () => {
    expect(resumeWorkflow(parkedRecord, NOW)).toEqual({
      ok: true,
      value: { record: runningRecord, transitions: [{ kind: "resume", at: NOW }] },
    });
  });

  test("refuses to resume work that is running", () => {
    expect(resumeWorkflow(runningRecord, NOW)).toEqual({
      ok: false,
      refusal: { kind: "workflow-status", status: { kind: "running" }, needed: "parked" },
    });
  });
});

describe("completeWorkflow", () => {
  test("completes running work whose stages are all finished", () => {
    expect(completeWorkflow({ ...runningRecord, stages: finishedStages }, NOW)).toEqual({
      ok: true,
      value: {
        record: { ...finishedRecord, status: { kind: "completed", at: NOW } },
        transitions: [{ kind: "complete", at: NOW }],
      },
    });
  });

  test("refuses while a stage is unfinished and names it", () => {
    expect(completeWorkflow(runningRecord, NOW)).toEqual({
      ok: false,
      refusal: {
        kind: "stages-unfinished",
        remaining: [{ stage: design, unit: null, progress: "in-progress" }],
      },
    });
  });

  test("refuses to complete parked work", () => {
    expect(completeWorkflow(parkedRecord, NOW)).toEqual({
      ok: false,
      refusal: { kind: "workflow-status", status: parkedRecord.status, needed: "running" },
    });
  });
});

describe("reopenWorkflow", () => {
  test("takes finished work back to running with whether the person spoke since", () => {
    expect(reopenWorkflow(finishedRecord, { time: NOW, personSinceFinished: "spoke" })).toEqual({
      ok: true,
      value: {
        record: { ...finishedRecord, status: { kind: "running" } },
        transitions: [{ kind: "reopen", personSinceFinished: "spoke", at: NOW }],
      },
    });
  });

  test("refuses to reopen work that is still running", () => {
    expect(reopenWorkflow(runningRecord, { time: NOW, personSinceFinished: "spoke" })).toEqual({
      ok: false,
      refusal: { kind: "workflow-status", status: { kind: "running" }, needed: "completed" },
    });
  });
});
