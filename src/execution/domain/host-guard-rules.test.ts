import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at, path } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { CHAT, RUNNING_RECORD, stageOf } from "../fixtures/workflow-record.fixture.ts";
import type { AuditEvent } from "./audit.ts";
import { CORE_GUARDS } from "./guard.ts";
import type { HostEventAt } from "./host-event.ts";
import {
  CORE_HOST_RULES,
  forwardingLoopRule,
  forwardingSinceProgress,
  reviewFreezeRule,
  type ArtifactPlacement,
  type HostSituation,
} from "./host-guard-rules.ts";
import { auditSequence } from "./identities.ts";
import type { ReviewReceipt } from "./review.ts";
import { UPSTREAM_BUDGET_SPENT, type RouteContext } from "./routing.ts";
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

const NOW = at("2026-11-08T10:20:00Z");

const routing: RouteContext = {
  method: methodSliceFixture,
  personAsked: "not-asked",
  time: NOW,
  budgetSpent: UPSTREAM_BUDGET_SPENT,
};

const writing = (subject: string): HostEventAt<"before-tool"> => ({
  point: "before-tool",
  session: CHAT,
  at: NOW,
  tool: { name: "Write", classified: "file-write", subject },
});

const beforeWrite = (subject: string): HostSituation<"before-tool"> => ({
  point: "before-tool",
  event: writing(subject),
  record: reviewedRecord,
  method: methodSliceFixture,
  events: [],
  placement,
  routing,
});

describe("reviewFreezeRule", () => {
  test("stops a write to an artifact frozen by its review", () => {
    expect(reviewFreezeRule.check(beforeWrite("aidlc/intents/checkout-flow/requirements.md"))).toMatchObject({
      guard: CORE_GUARDS.reviewFreeze,
    });
  });

  test("lets any other write through", () => {
    expect(reviewFreezeRule.check(beforeWrite("src/checkout/cart.ts"))).toBeNull();
  });

  test("lets a read of the frozen artifact through", () => {
    expect(
      reviewFreezeRule.check({
        ...beforeWrite("aidlc/intents/checkout-flow/requirements.md"),
        event: {
          ...writing("aidlc/intents/checkout-flow/requirements.md"),
          tool: { name: "Read", classified: "file-read", subject: "aidlc/intents/checkout-flow/requirements.md" },
        },
      }),
    ).toBeNull();
  });
});

const runningRequirements: WorkflowRecord = {
  ...RUNNING_RECORD,
  stages: [{ stage: requirements, unit: null, progress: "in-progress" }],
};

const autonomous: WorkflowRecord = {
  ...runningRequirements,
  settings: { ...RUNNING_RECORD.settings, constructionAutonomy: "autonomous" },
};

const atStop = (record: WorkflowRecord, events: readonly AuditEvent[]): HostSituation<"stop"> => ({
  point: "stop",
  event: { point: "stop", session: CHAT, at: NOW },
  record,
  method: methodSliceFixture,
  events,
  placement,
  routing,
});

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

describe("forwardingLoopRule", () => {
  test("keeps an autonomous run going while a step is pending", () => {
    expect(forwardingLoopRule.check(atStop(autonomous, []))).toEqual({
      guard: CORE_GUARDS.forwardingLoop,
      reason: "AI-DLC is carrying on with running Requirements Analysis.",
      nextStep: "Ask the engine for the next step and carry that out before ending the turn.",
    });
  });

  test("lets a gated run end its turn", () => {
    expect(forwardingLoopRule.check(atStop(runningRequirements, []))).toBeNull();
  });

  test("gives up after eight stops with no progress between them", () => {
    expect(forwardingSinceProgress(eightForwarded)).toBe(8);
    expect(forwardingLoopRule.check(atStop(autonomous, eightForwarded))).toBeNull();
  });
});

describe("CORE_HOST_RULES", () => {
  test("checks writes before a tool runs and pending work when the turn stops", () => {
    expect(CORE_HOST_RULES).toEqual({
      "user-prompt": [],
      "before-tool": [reviewFreezeRule],
      "subagent-stop": [],
      stop: [forwardingLoopRule],
    });
  });
});
