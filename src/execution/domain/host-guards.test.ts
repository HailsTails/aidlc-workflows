import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at, path } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { RUNNING_RECORD, stageOf } from "../fixtures/workflow-record.fixture.ts";
import type { AuditEvent } from "./audit.ts";
import { CORE_GUARDS } from "./guard.ts";
import {
  forwardingSinceProgress,
  forwardingStop,
  writeStop,
  type ArtifactPlacement,
} from "./host-guards.ts";
import { auditSequence } from "./identities.ts";
import type { ReviewReceipt } from "./review.ts";
import { nextRoute, type RouteStep } from "./routing.ts";
import type { WorkflowRecord } from "./workflow-record.ts";

const requirements = stageOf("requirements-analysis");
const document = accept(artifactName("requirements"));
const placement: ArtifactPlacement = () => path("aidlc/intents/checkout-flow/requirements.md");

const readyReview: ReviewReceipt = {
  attempt: {
    stage: requirements,
    unit: null,
    artifact: document,
    reviewer: accept(agentSlug("aidlc-product-lead-agent")),
    reviewClass: "advisory",
    iteration: 1,
    requestedAt: at("2026-11-08T10:00:00Z"),
  },
  verdict: "ready",
  findings: [],
  receivedAt: at("2026-11-08T10:10:00Z"),
};

const reviewedRecord: WorkflowRecord = {
  ...RUNNING_RECORD,
  stages: [{ stage: requirements, unit: null, progress: "awaiting-approval" }],
  reviews: [readyReview],
};

const watch = { record: reviewedRecord, method: methodSliceFixture, placement };

describe("writeStop", () => {
  test("stops a write to an artifact frozen by its review", () => {
    expect(writeStop(watch, "aidlc/intents/checkout-flow/requirements.md")).toMatchObject({
      guard: CORE_GUARDS.reviewFreeze,
    });
  });

  test("lets any other write through", () => {
    expect(writeStop(watch, "src/checkout/cart.ts")).toBeNull();
  });
});

const runRequirements: RouteStep = nextRoute(
  { ...RUNNING_RECORD, stages: [{ stage: requirements, unit: null, progress: "in-progress" }] },
  { method: methodSliceFixture, personAsked: "not-asked", time: at("2026-11-08T10:00:00Z") },
);

const autonomous: WorkflowRecord = {
  ...RUNNING_RECORD,
  settings: { ...RUNNING_RECORD.settings, constructionAutonomy: "autonomous" },
};

const forwarded = (sequence: number): AuditEvent => ({
  intent: RUNNING_RECORD.id,
  session: null,
  at: at("2026-11-08T10:00:00Z"),
  causedBy: null,
  sequence: accept(auditSequence(sequence)),
  fact: {
    kind: "guard-refused",
    refusal: { guard: CORE_GUARDS.forwardingLoop, reason: "carrying on", nextStep: "go on" },
  },
});

const eightForwarded: readonly AuditEvent[] = [
  forwarded(1),
  forwarded(2),
  forwarded(3),
  forwarded(4),
  forwarded(5),
  forwarded(6),
  forwarded(7),
  forwarded(8),
];

describe("forwardingStop", () => {
  test("keeps an autonomous run going while a step is pending", () => {
    expect(forwardingStop({ record: autonomous, route: runRequirements, events: [] })).toEqual({
      guard: CORE_GUARDS.forwardingLoop,
      reason: "AI-DLC is carrying on with running Requirements Analysis.",
      nextStep: "Ask the engine for the next step and carry that out before ending the turn.",
    });
  });

  test("lets a gated run end its turn", () => {
    expect(forwardingStop({ record: RUNNING_RECORD, route: runRequirements, events: [] })).toBeNull();
  });

  test("gives up after eight stops with no progress between them", () => {
    expect(forwardingSinceProgress(eightForwarded)).toBe(8);
    expect(
      forwardingStop({ record: autonomous, route: runRequirements, events: eightForwarded }),
    ).toBeNull();
  });
});
