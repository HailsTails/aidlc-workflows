import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { RUNNING_RECORD, stageOf, typedTurn, unitOf } from "../fixtures/workflow-record.fixture.ts";
import type { Approval } from "./gate.ts";
import { planFingerprint } from "./identities.ts";
import { planApprovalStanding, type PlanTarget } from "./plan-approval.ts";

const generation = stageOf("code-generation");
const ledger = unitOf("ledger");
const APPROVED_PLAN = accept(
  planFingerprint("sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5"),
);
const EDITED_PLAN = accept(
  planFingerprint("sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326"),
);

const target: PlanTarget = { stage: generation, unit: ledger, current: APPROVED_PLAN };

const planApproved: Approval = {
  gate: { kind: "plan-approval", stage: generation, unit: ledger },
  decision: { kind: "approve" },
  decidedAt: at("2026-11-08T10:00:00Z"),
  evidence: typedTurn(at("2026-11-08T09:59:00Z")),
  fingerprint: APPROVED_PLAN,
};

const changesAsked: Approval = {
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

  test("another Unit's approval does not count", () => {
    expect(
      planApprovalStanding(
        { ...RUNNING_RECORD, approvals: [planApproved] },
        { ...target, unit: unitOf("payments-api") },
      ),
    ).toEqual({ kind: "unapproved", target: { ...target, unit: unitOf("payments-api") } });
  });
});
