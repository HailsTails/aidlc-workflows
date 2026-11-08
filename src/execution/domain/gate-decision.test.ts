import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { heardAt, RUNNING_RECORD, stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import type { Gate } from "./gate.ts";
import { CORE_GUARDS, type GuardRefusal } from "./guard.ts";
import { decideAtGate, keepUnapplied } from "./gate-decision.ts";
import { planFingerprint } from "./identities.ts";
import type { Checkpoint } from "./unit.ts";
import type { RecordedApproval, WorkflowRecord } from "./workflow-record.ts";

const NOW = at("2026-11-08T10:10:00Z");
const HEARD = heardAt(at("2026-11-08T10:05:00Z"));
const requirements = stageOf("requirements-analysis");
const generation = stageOf("code-generation");
const ledger = unitOf("ledger");
const PLAN = accept(
  planFingerprint("sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5"),
);

const requirementsGate: Gate = { kind: "stage", stage: requirements, unit: null };

const ledgerCheckpoint: Checkpoint = {
  kind: "unit",
  unit: ledger,
  stages: [generation],
  fingerprint: PLAN,
  verification: "verified",
  approval: "awaiting-approval",
};

const atCheckpoint: WorkflowRecord = {
  ...RUNNING_RECORD,
  stages: [
    { stage: requirements, unit: null, progress: "completed" },
    { stage: generation, unit: ledger, progress: "completed" },
  ],
  checkpoints: [ledgerCheckpoint],
};

const approvalAt = (gate: Gate): RecordedApproval => ({
  gate,
  decision: { kind: "approve" },
  decidedAt: NOW,
  basis: HEARD,
  fingerprint: null,
  outcome: { kind: "applied" },
});

describe("decideAtGate at a stage gate", () => {
  test("Request Changes sends the stage to revising and records the person's approval row", () => {
    const decided = decideAtGate(RUNNING_RECORD, {
      gate: requirementsGate,
      decision: { kind: "request-changes", feedback: "Add the refund rules." },
      basis: HEARD,
      fingerprint: null,
      time: NOW,
    });

    expect(decided).toMatchObject({
      ok: true,
      value: {
        transitions: [{ stage: requirements, from: "awaiting-approval", to: "revising" }],
        approval: { decision: { kind: "request-changes", feedback: "Add the refund rules." } },
      },
    });
  });

});

describe("decideAtGate takes the person's word", () => {
  test("the person's approval is taken even before the agent put the stage to them", () => {
    const early: WorkflowRecord = {
      ...RUNNING_RECORD,
      stages: [{ stage: requirements, unit: null, progress: "in-progress" }],
    };

    expect(
      decideAtGate(early, {
        gate: requirementsGate,
        decision: { kind: "approve" },
        basis: HEARD,
        fingerprint: null,
        time: NOW,
      }),
    ).toEqual({
      ok: true,
      value: {
        record: {
          ...early,
          stages: [{ stage: requirements, unit: null, progress: "completed" }],
          approvals: [approvalAt(requirementsGate)],
        },
        transitions: [
          {
            kind: "stage",
            stage: requirements,
            unit: null,
            from: "in-progress",
            to: "completed",
            cause: { kind: "person-decision", decision: { kind: "approve" } },
            at: NOW,
          },
        ],
        approval: approvalAt(requirementsGate),
      },
    });
  });

});

describe("decideAtGate stopping and refusing", () => {
  test("Stop parks the work", () => {
    expect(
      decideAtGate(RUNNING_RECORD, {
        gate: requirementsGate,
        decision: { kind: "stop" },
        basis: HEARD,
        fingerprint: null,
        time: NOW,
      }),
    ).toMatchObject({
      ok: true,
      value: { record: { status: { kind: "parked", since: NOW } }, transitions: [{ kind: "park" }] },
    });
  });

  test("refuses a gate on a stage this work does not run", () => {
    expect(
      decideAtGate(RUNNING_RECORD, {
        gate: { kind: "stage", stage: stageOf("build-and-test"), unit: null },
        decision: { kind: "approve" },
        basis: HEARD,
        fingerprint: null,
        time: NOW,
      }),
    ).toEqual({
      ok: false,
      refusal: { kind: "stage-not-in-plan", stage: stageOf("build-and-test"), unit: null },
    });
  });
});

describe("decideAtGate at a plan approval or checkpoint", () => {
  test("approving the plan records its fingerprint and moves no stage", () => {
    const planGate: Gate = { kind: "plan-approval", stage: generation, unit: ledger };

    expect(
      decideAtGate(atCheckpoint, {
        gate: planGate,
        decision: { kind: "approve" },
        basis: HEARD,
        fingerprint: PLAN,
        time: NOW,
      }),
    ).toMatchObject({ ok: true, value: { transitions: [], approval: { fingerprint: PLAN } } });
  });

  test("approving a Unit checkpoint marks that checkpoint approved", () => {
    expect(
      decideAtGate(atCheckpoint, {
        gate: { kind: "checkpoint", checkpoint: ledgerCheckpoint },
        decision: { kind: "approve" },
        basis: HEARD,
        fingerprint: null,
        time: NOW,
      }),
    ).toMatchObject({
      ok: true,
      value: { record: { checkpoints: [{ ...ledgerCheckpoint, approval: "approved" }] } },
    });
  });

  test("Request Changes at a Unit checkpoint sends that Unit's stages back to revising", () => {
    expect(
      decideAtGate(atCheckpoint, {
        gate: { kind: "checkpoint", checkpoint: ledgerCheckpoint },
        decision: { kind: "request-changes", feedback: "Retry the ledger sync." },
        basis: HEARD,
        fingerprint: null,
        time: NOW,
      }),
    ).toMatchObject({
      ok: true,
      value: { transitions: [{ stage: generation, unit: ledger, from: "completed", to: "revising" }] },
    });
  });
});

describe("keepUnapplied", () => {
  test("keeps the person's decision with the refusal that stopped it, and moves nothing", () => {
    const parked: GuardRefusal = {
      guard: CORE_GUARDS.stateTransition,
      reason: "This work is parked; that step needs it running.",
      nextStep: "Ask the engine for the next step and carry that out.",
    };

    expect(
      keepUnapplied(RUNNING_RECORD, {
        request: {
          gate: requirementsGate,
          decision: { kind: "approve" },
          basis: HEARD,
          fingerprint: null,
          time: NOW,
        },
        refusal: parked,
      }),
    ).toMatchObject({
      record: {
        stages: RUNNING_RECORD.stages,
        approvals: [{ decision: { kind: "approve" }, outcome: { kind: "recorded-not-applied", refusal: parked } }],
      },
      transitions: [],
    });
  });
});
