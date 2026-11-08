import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { RUNNING_RECORD, stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import type { ReviewReceipt } from "./review.ts";
import { nextRoute, type RouteContext } from "./routing.ts";
import type { StageState, WorkflowRecord } from "./workflow-record.ts";

const NOW = at("2026-11-08T10:00:00Z");
const requirements = stageOf("requirements-analysis");
const units = stageOf("units-generation");
const generation = stageOf("code-generation");
const ledger = unitOf("ledger");

const context: RouteContext = { method: methodSliceFixture, personAsked: "not-asked", time: NOW };

const withStages = (stages: readonly StageState[]): WorkflowRecord => ({ ...RUNNING_RECORD, stages });

const notStarted = withStages([
  { stage: requirements, unit: null, progress: "pending" },
  { stage: units, unit: null, progress: "pending" },
]);

const requirementsAt = (progress: StageState["progress"]): WorkflowRecord =>
  withStages([
    { stage: requirements, unit: null, progress },
    { stage: units, unit: null, progress: "pending" },
  ]);

describe("nextRoute through a stage", () => {
  test("starts the first stage that has not started", () => {
    expect(nextRoute(notStarted, context)).toMatchObject({
      kind: "moved",
      change: { transitions: [{ stage: requirements, from: "pending", to: "in-progress" }] },
    });
  });

  test("tells the conductor to run a stage in progress, with its lead and rules", () => {
    expect(nextRoute(requirementsAt("in-progress"), context)).toMatchObject({
      kind: "run-stage",
      work: {
        stage: { slug: requirements },
        unit: null,
        lead: "aidlc-product-agent",
        supports: [],
        rules: ["org", "team", "phase-inception"],
      },
    });
  });

  test("asks for the stage's review before the gate", () => {
    expect(nextRoute(requirementsAt("awaiting-approval"), context)).toMatchObject({
      kind: "request-review",
      attempt: { stage: requirements, reviewer: "aidlc-product-lead-agent", iteration: 1 },
    });
  });

  test("puts the gate to the person once there is no review to run", () => {
    const unreviewed: WorkflowRecord = {
      ...requirementsAt("awaiting-approval"),
      settings: { ...RUNNING_RECORD.settings, reviewOverride: "none" },
    };

    expect(nextRoute(unreviewed, context)).toMatchObject({
      kind: "ask-person",
      gate: { kind: "stage", stage: requirements, unit: null },
    });
  });
});

describe("nextRoute with the review budget spent", () => {
  const notReadyAt = (iteration: number): ReviewReceipt => ({
    attempt: {
      stage: generation,
      unit: ledger,
      artifact: accept(artifactName("code-generation-plan")),
      reviewer: accept(agentSlug("aidlc-architecture-reviewer-agent")),
      reviewClass: "adversarial",
      iteration,
      requestedAt: at("2026-11-08T09:00:00Z"),
    },
    verdict: "not-ready",
    findings: [],
    receivedAt: at("2026-11-08T09:30:00Z"),
  });

  test("puts the gate to the person", () => {
    const spent: WorkflowRecord = {
      ...withStages([{ stage: generation, unit: ledger, progress: "awaiting-approval" }]),
      reviews: [notReadyAt(1), notReadyAt(2)],
    };

    expect(nextRoute(spent, context)).toMatchObject({
      kind: "ask-person",
      gate: { kind: "stage", stage: generation, unit: ledger },
    });
  });
});

describe("nextRoute under autonomy and at the end", () => {
  test("approves a Construction gate itself under autonomous Construction", () => {
    const autonomous: WorkflowRecord = {
      ...withStages([{ stage: generation, unit: ledger, progress: "awaiting-approval" }]),
      settings: {
        ...RUNNING_RECORD.settings,
        constructionAutonomy: "autonomous",
        reviewOverride: "none",
      },
    };

    expect(nextRoute(autonomous, context)).toMatchObject({
      kind: "moved",
      change: { transitions: [{ stage: generation, to: "completed", cause: { kind: "engine-step" } }] },
    });
  });

  test("completes the work once every stage is finished", () => {
    expect(
      nextRoute(withStages([{ stage: requirements, unit: null, progress: "completed" }]), context),
    ).toMatchObject({ kind: "moved", change: { transitions: [{ kind: "complete" }] } });
  });

  test("finished work has nothing next", () => {
    expect(nextRoute({ ...RUNNING_RECORD, status: { kind: "completed", at: NOW } }, context)).toEqual({
      kind: "finished",
    });
  });
});

describe("nextRoute stops", () => {
  test("parked work waits for the person to resume it", () => {
    expect(nextRoute({ ...RUNNING_RECORD, status: { kind: "parked", since: NOW } }, context)).toEqual({
      kind: "stopped",
      refusal: {
        kind: "workflow-status",
        status: { kind: "parked", since: NOW },
        needed: "running",
      },
    });
  });

  test("a stage the installed method no longer has stops the route", () => {
    const detection = stageOf("workspace-detection");

    expect(nextRoute(withStages([{ stage: detection, unit: null, progress: "pending" }]), context)).toEqual({
      kind: "stopped",
      refusal: { kind: "stage-not-in-plan", stage: detection, unit: null },
    });
  });
});
