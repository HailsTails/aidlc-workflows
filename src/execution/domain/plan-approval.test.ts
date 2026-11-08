import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { heardAt, RUNNING_RECORD, stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS } from "./guard.ts";
import { planFingerprint } from "./identities.ts";
import { planApprovalStanding, type PlanTarget } from "./plan-approval.ts";
import type { RecordedApproval } from "./workflow-record.ts";

const generation = stageOf("code-generation");
const ledger = unitOf("ledger");
const APPROVED_PLAN = accept(
  planFingerprint("sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5"),
);
const EDITED_PLAN = accept(
  planFingerprint("sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326"),
);

const target: PlanTarget = { stage: generation, unit: ledger, current: APPROVED_PLAN };

const planApproved: RecordedApproval = {
  gate: { kind: "plan-approval", stage: generation, unit: ledger },
  decision: { kind: "approve" },
  decidedAt: at("2026-11-08T10:00:00Z"),
  basis: heardAt(at("2026-11-08T09:59:00Z")),
  fingerprint: APPROVED_PLAN,
  outcome: { kind: "applied" },
};

const changesAsked: RecordedApproval = {
  ...planApproved,
  gate: { kind: "stage", stage: generation, unit: ledger },
  decision: { kind: "request-changes", feedback: "Split the ledger writer." },
  decidedAt: at("2026-11-08T11:00:00Z"),
  fingerprint: null,
};

describe("planApprovalStanding", () => {
  test("holds while the plan is the one the person approved", () => {
    expect(planApprovalStanding({ ...RUNNING_RECORD, approvals: [planApproved] }, target)).toEqual({
      kind: "approved",
      approval: planApproved,
    });
  });

  test("goes stale when the plan changed since", () => {
    expect(
      planApprovalStanding(
        { ...RUNNING_RECORD, approvals: [planApproved] },
        { ...target, current: EDITED_PLAN },
      ),
    ).toEqual({
      kind: "stale",
      approval: planApproved,
      target: { ...target, current: EDITED_PLAN },
    });
  });

  test("a later Request Changes on the stage starts a new attempt with no approved plan", () => {
    expect(
      planApprovalStanding({ ...RUNNING_RECORD, approvals: [planApproved, changesAsked] }, target),
    ).toEqual({ kind: "unapproved", target });
  });

  test("a decision that was recorded but not applied does not start a new attempt", () => {
    const unapplied: RecordedApproval = {
      ...changesAsked,
      outcome: {
        kind: "recorded-not-applied",
        refusal: {
          guard: CORE_GUARDS.stateTransition,
          reason: "This work is parked; that step needs it running.",
          nextStep: "Ask the engine for the next step and carry that out.",
        },
      },
    };

    expect(
      planApprovalStanding({ ...RUNNING_RECORD, approvals: [planApproved, unapplied] }, target),
    ).toEqual({ kind: "approved", approval: planApproved });
  });

  test("a jump to another stage starts a new attempt, as it does for reviews", () => {
    const jumped: RecordedApproval = {
      ...changesAsked,
      gate: { kind: "stage", stage: stageOf("requirements-analysis"), unit: null },
      decision: { kind: "jump", to: generation },
    };

    expect(
      planApprovalStanding({ ...RUNNING_RECORD, approvals: [planApproved, jumped] }, target),
    ).toEqual({ kind: "unapproved", target });
  });

  test("another Unit's approval does not count", () => {
    expect(
      planApprovalStanding(
        { ...RUNNING_RECORD, approvals: [planApproved] },
        { ...target, unit: unitOf("payments-api") },
      ),
    ).toEqual({ kind: "unapproved", target: { ...target, unit: unitOf("payments-api") } });
  });
});
