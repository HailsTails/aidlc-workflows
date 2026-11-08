import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import { stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import type { Gate } from "./gate.ts";
import { CORE_GUARDS } from "./guard.ts";
import {
  humanPresenceRule,
  planApprovalRule,
  reviewReceiptRule,
  stateTransitionRule,
} from "./guard-rules.ts";
import { planFingerprint } from "./identities.ts";
import type { PlanTarget } from "./plan-approval.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";

const requirements = stageOf("requirements-analysis");
const generation = stageOf("code-generation");
const ledger = unitOf("ledger");
const requirementsGate: Gate = { kind: "stage", stage: requirements, unit: null };

describe("stateTransitionRule", () => {
  test("names what the record needs, locked in the record so no switch lifts it", () => {
    expect(
      stateTransitionRule.check({
        kind: "workflow-status",
        status: { kind: "parked", since: at("2026-11-08T10:00:00Z") },
        needed: "running",
      }),
    ).toEqual({
      guard: { ...CORE_GUARDS.stateTransition, lift: { kind: "locked", lockedIn: "this work's record" } },
      reason: "This work is parked; that step needs it running.",
      nextStep: "Ask the engine for the next step and carry that out.",
    });
  });

  test("names a Unit's stage that is not in the plan", () => {
    expect(
      stateTransitionRule.check({ kind: "stage-not-in-plan", stage: generation, unit: ledger }).reason,
    ).toBe("code-generation for Unit ledger is not a stage this work runs.");
  });
});

const requested: ReviewAttempt = {
  stage: requirements,
  unit: null,
  artifact: accept(artifactName("requirements")),
  reviewer: accept(agentSlug("aidlc-product-lead-agent")),
  reviewClass: "advisory",
  iteration: 1,
  requestedAt: at("2026-11-08T10:00:00Z"),
};

const receiptFor = (attempt: ReviewAttempt): ReviewReceipt => ({
  attempt,
  verdict: "ready",
  findings: [],
  receivedAt: at("2026-11-08T10:10:00Z"),
});

describe("reviewReceiptRule", () => {
  test("lets through the receipt the engine asked for", () => {
    expect(reviewReceiptRule.check({ receipt: receiptFor(requested), requested })).toBeNull();
  });

  test("stops a receipt from a reviewer the engine did not ask, under its own guard", () => {
    expect(
      reviewReceiptRule.check({
        receipt: receiptFor({ ...requested, reviewer: accept(agentSlug("aidlc-quality-agent")) }),
        requested,
      }),
    ).toEqual({
      guard: reviewReceiptRule.declaration,
      reason: "The engine asked aidlc-product-lead-agent for this review, not aidlc-quality-agent.",
      nextStep: "Ask the engine for the next step and carry that out.",
    });
  });

  test("stops a receipt for an iteration the engine did not ask for", () => {
    expect(
      reviewReceiptRule.check({ receipt: receiptFor({ ...requested, iteration: 2 }), requested }),
    ).toMatchObject({ reason: "The engine asked for review 1, not review 2." });
  });
});

describe("humanPresenceRule", () => {
  test("a gate with no reply since it opened waits for the person", () => {
    expect(humanPresenceRule.check({ asked: "gate", gate: requirementsGate, heard: "absent" })).toEqual({
      guard: CORE_GUARDS.humanPresence,
      reason: "No reply the person typed has reached the requirements-analysis gate since it opened.",
      nextStep: "Wait for the person to type their choice, then record it.",
    });
  });

  test("a gate never put to the person tells the agent to ask the engine", () => {
    expect(humanPresenceRule.check({ asked: "gate", gate: requirementsGate, heard: "unopened" })).toEqual({
      guard: CORE_GUARDS.humanPresence,
      reason: "Nothing has put the requirements-analysis gate to the person yet.",
      nextStep: "Ask the engine for the next step; it puts each gate to the person when it is due.",
    });
  });

  test("finished work reopens only on the person's own words", () => {
    expect(humanPresenceRule.check({ asked: "reopen" }).reason).toBe(
      "The person has not asked, in this chat, to reopen this finished work.",
    );
  });
});

const target: PlanTarget = {
  stage: generation,
  unit: ledger,
  current: accept(
    planFingerprint("sha256:5e312852de6e183521a2719293865370e1e2b196c9dd5286b9389a3896fa22d5"),
  ),
};

describe("planApprovalRule", () => {
  test("stops work on a plan the person never approved", () => {
    expect(planApprovalRule.check({ kind: "unapproved", target })).toEqual({
      guard: CORE_GUARDS.planApproval,
      reason: "code-generation for Unit ledger has no plan the person approved.",
      nextStep: "Ask the engine for the next step; it puts the plan to the person for approval.",
    });
  });
});
