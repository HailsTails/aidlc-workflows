import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import type { ReviewPolicy } from "../../workflow-definition/domain/stage.ts";
import { RUNNING_RECORD, stageOf, typedTurn } from "../fixtures/workflow-record.fixture.ts";
import type { Approval } from "./gate.ts";
import type { ReviewAttempt, ReviewReceipt } from "./review.ts";
import {
  artifactFreeze,
  nextReviewStep,
  recordReceipt,
  reviewClassFor,
  type ReviewNeed,
} from "./review-attempt.ts";
import type { WorkflowRecord } from "./workflow-record.ts";

const requirements = stageOf("requirements-analysis");
const document = accept(artifactName("requirements"));
const reviewer = accept(agentSlug("aidlc-product-lead-agent"));
const NOW = at("2026-11-08T11:00:00Z");

const adversarial: ReviewPolicy = {
  reviewer,
  artifact: document,
  maxIterations: 2,
  reviewClass: "adversarial",
};

const firstAttempt: ReviewAttempt = {
  stage: requirements,
  unit: null,
  artifact: document,
  reviewer,
  reviewClass: "adversarial",
  iteration: 1,
  requestedAt: at("2026-11-08T10:00:00Z"),
};

const notReady: ReviewReceipt = {
  attempt: firstAttempt,
  verdict: "not-ready",
  findings: [{ id: "F1", status: "open", summary: "Refund rules are missing." }],
  receivedAt: at("2026-11-08T10:20:00Z"),
};

const ready: ReviewReceipt = {
  attempt: { ...firstAttempt, iteration: 2, requestedAt: at("2026-11-08T10:30:00Z") },
  verdict: "ready",
  findings: [{ id: "F1", status: "resolved", summary: "Refund rules are missing." }],
  receivedAt: at("2026-11-08T10:40:00Z"),
};

const need: ReviewNeed = {
  at: { stage: requirements, unit: null },
  policy: adversarial,
  reviewClass: "adversarial",
  personAsked: "not-asked",
  time: NOW,
};

const reviewed = (reviews: readonly ReviewReceipt[]): WorkflowRecord => ({ ...RUNNING_RECORD, reviews });

describe("reviewClassFor", () => {
  test.each([
    { override: null, scopeCap: null, resolved: "adversarial" },
    { override: "advisory", scopeCap: null, resolved: "advisory" },
    { override: null, scopeCap: "none", resolved: "none" },
    { override: "advisory", scopeCap: "none", resolved: "advisory" },
  ] as const)("override $override, scope cap $scopeCap: $resolved", ({ override, scopeCap, resolved }) => {
    expect(reviewClassFor({ declared: adversarial, override, scopeCap })).toBe(resolved);
  });

  test("never raises a stage with no reviewer", () => {
    expect(reviewClassFor({ declared: null, override: "adversarial", scopeCap: null })).toBe("none");
  });
});

describe("nextReviewStep", () => {
  test("asks for the first review", () => {
    expect(nextReviewStep(RUNNING_RECORD, need)).toEqual({
      kind: "request",
      attempt: { ...firstAttempt, requestedAt: NOW },
    });
  });

  test("asks again after a not-ready verdict within the budget", () => {
    expect(nextReviewStep(reviewed([notReady]), need)).toMatchObject({
      kind: "request",
      attempt: { iteration: 2 },
    });
  });

  test("is finished once the review is ready", () => {
    expect(nextReviewStep(reviewed([notReady, ready]), need)).toEqual({ kind: "finished", receipt: ready });
  });

  test("the person asking for another review lifts the budget", () => {
    expect(
      nextReviewStep(reviewed([notReady, ready]), { ...need, personAsked: "asked" }),
    ).toMatchObject({ kind: "request", attempt: { iteration: 3 } });
  });

  test("a stage with no review class has no review", () => {
    expect(nextReviewStep(RUNNING_RECORD, { ...need, reviewClass: "none" })).toEqual({
      kind: "no-review",
      at: need.at,
    });
  });
});

describe("a spent review budget", () => {
  const stillNotReady: ReviewReceipt = {
    ...notReady,
    attempt: { ...firstAttempt, iteration: 2, requestedAt: at("2026-11-08T10:30:00Z") },
    receivedAt: at("2026-11-08T10:40:00Z"),
  };

  test("is its own step once every iteration came back not ready", () => {
    expect(nextReviewStep(reviewed([notReady, stillNotReady]), need)).toEqual({
      kind: "budget-spent",
      at: need.at,
      budget: 2,
    });
  });

  test("still freezes the artifact as reviewed", () => {
    expect(
      artifactFreeze(reviewed([notReady, stillNotReady]), {
        at: need.at,
        artifact: document,
        budget: 2,
      }),
    ).toEqual({ kind: "frozen", receipt: stillNotReady });
  });
});

describe("attempts", () => {
  test("Request Changes at the gate starts a new attempt with its own iterations", () => {
    const changes: Approval = {
      gate: { kind: "stage", stage: requirements, unit: null },
      decision: { kind: "request-changes", feedback: "Add the refund rules." },
      decidedAt: at("2026-11-08T10:50:00Z"),
      evidence: typedTurn(at("2026-11-08T10:49:00Z")),
      fingerprint: null,
    };

    expect(
      nextReviewStep({ ...reviewed([notReady, ready]), approvals: [changes] }, need),
    ).toMatchObject({ kind: "request", attempt: { iteration: 1 } });
  });
});

describe("recordReceipt", () => {
  test("keeps the receipt the engine asked for", () => {
    expect(recordReceipt(RUNNING_RECORD, { receipt: notReady, requested: firstAttempt })).toEqual({
      ok: true,
      value: reviewed([notReady]),
    });
  });

  test("refuses a receipt for an iteration the engine did not ask for", () => {
    expect(recordReceipt(RUNNING_RECORD, { receipt: ready, requested: firstAttempt })).toEqual({
      ok: false,
      refusal: { kind: "unrequested-iteration", expected: 1, found: 2 },
    });
  });
});

describe("artifactFreeze", () => {
  test("a final review freezes the artifact until the stage completes or the person asks for changes", () => {
    expect(
      artifactFreeze(reviewed([notReady, ready]), { at: need.at, artifact: document, budget: 2 }),
    ).toEqual({ kind: "frozen", receipt: ready });
  });

  test("an open review leaves the artifact open", () => {
    expect(artifactFreeze(reviewed([notReady]), { at: need.at, artifact: document, budget: 2 })).toEqual({
      kind: "open",
    });
  });
});
