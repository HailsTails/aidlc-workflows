import { describe, expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { agentSlug, artifactName } from "../../workflow-definition/domain/identities.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import {
  artifactsUnder,
  chatOn,
  fixedClock,
  guardsAsRecorded,
  installedMethod,
  memoryAuditLog,
  memoryRecordStore,
} from "../fixtures/fakes.fixture.ts";
import { CHAT, RUNNING_RECORD, stageOf, typedTurn } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS, guardId, type GuardDeclaration } from "../domain/guard.ts";
import { composeGuards } from "../domain/guard-inventory.ts";
import { NO_HOST_RULES, type HostGuardRule } from "../domain/host-guard-rules.ts";
import { UPSTREAM_BUDGET_SPENT } from "../domain/routing.ts";
import type { HostEvent } from "../domain/host-event.ts";
import type { WorkflowRecord } from "../domain/workflow-record.ts";
import { observeHostEventUseCase, type ObserveHostEventDependencies } from "./observe-host-event.ts";

const NOW = at("2026-11-08T11:00:00Z");
const requirements = stageOf("requirements-analysis");
const FROZEN_PATH = "aidlc/intents/checkout-flow/intent/requirements.md";

const reviewed: WorkflowRecord = {
  ...RUNNING_RECORD,
  stages: [{ stage: requirements, unit: null, progress: "awaiting-approval" }],
  reviews: [
    {
      attempt: {
        stage: requirements,
        unit: null,
        artifact: accept(artifactName("requirements")),
        reviewer: accept(agentSlug("aidlc-product-lead-agent")),
        reviewClass: "advisory",
        iteration: 1,
        requestedAt: at("2026-11-08T10:00:00Z"),
      },
      verdict: "ready",
      findings: [],
      receivedAt: at("2026-11-08T10:10:00Z"),
    },
  ],
};

const hostOver = (record: WorkflowRecord): ObserveHostEventDependencies => ({
  sessions: chatOn(record.id),
  records: memoryRecordStore(record),
  audit: memoryAuditLog([]),
  clock: fixedClock(NOW),
  methods: installedMethod(methodSliceFixture),
  artifacts: artifactsUnder("aidlc/intents"),
  environment: guardsAsRecorded,
  rules: accept(composeGuards(NO_HOST_RULES)).host,
  budgetSpent: UPSTREAM_BUDGET_SPENT,
});

const writeToReviewed: HostEvent = {
  point: "before-tool",
  session: CHAT,
  at: NOW,
  tool: { name: "Write", classified: "file-write", subject: FROZEN_PATH },
};

describe("ObserveHostEvent before a tool", () => {
  test("blocks a write to a reviewed artifact and audits the stop as caused by the event", async () => {
    const host = hostOver(reviewed);

    expect(await observeHostEventUseCase(host).observe(writeToReviewed)).toMatchObject({
      event: writeToReviewed,
      verdict: { kind: "block", refusal: { guard: CORE_GUARDS.reviewFreeze } },
    });
    expect(await host.audit.since({ intent: RUNNING_RECORD.id, after: null })).toMatchObject([
      { sequence: 1, causedBy: null, fact: { kind: "host-event", point: "before-tool" } },
      { sequence: 2, causedBy: 1, fact: { kind: "guard-refused" } },
    ]);
  });

  test("stands aside under a relaxed Guard Policy and says so in the audit", async () => {
    const host = hostOver({
      ...reviewed,
      settings: { ...reviewed.settings, guardPolicy: "relaxed" },
    });

    expect(await observeHostEventUseCase(host).observe(writeToReviewed)).toMatchObject({
      verdict: { kind: "allow" },
    });
    expect(await host.audit.since({ intent: RUNNING_RECORD.id, after: null })).toMatchObject([
      { fact: { kind: "host-event" } },
      { fact: { kind: "guard-stood-aside", because: { kind: "policy", policy: "relaxed" } } },
    ]);
  });
});

describe("ObserveHostEvent at stop and status", () => {
  test("keeps an autonomous run going while a stage is in progress", async () => {
    const host = hostOver({
      ...reviewed,
      stages: [{ stage: requirements, unit: null, progress: "in-progress" }],
      settings: { ...reviewed.settings, constructionAutonomy: "autonomous" },
    });

    expect(
      await observeHostEventUseCase(host).observe({ point: "stop", session: CHAT, at: NOW }),
    ).toMatchObject({ verdict: { kind: "block", refusal: { guard: CORE_GUARDS.forwardingLoop } } });
  });

  test("shows where the work stands on the status line", async () => {
    expect(
      await observeHostEventUseCase(hostOver(reviewed)).observe({
        point: "status-line",
        session: CHAT,
        at: NOW,
      }),
    ).toMatchObject({
      verdict: {
        kind: "show-status",
        text: "AI-DLC · checkout-flow · requirements-analysis (awaiting-approval)",
      },
    });
  });

  test("a chat on no work is let through", async () => {
    const host = { ...hostOver(reviewed), sessions: chatOn(null) };

    expect(await observeHostEventUseCase(host).observe(writeToReviewed)).toMatchObject({
      verdict: { kind: "allow" },
    });
  });
});

const quietHours: GuardDeclaration = {
  id: accept(guardId("test-pro/quiet-hours")),
  protects: "No prompts reach the agent during the team's quiet hours.",
  lift: { kind: "switch" },
};

const quietAtPrompt: HostGuardRule<"user-prompt"> = {
  declaration: quietHours,
  check: () => ({ guard: quietHours, reason: "It is quiet hours.", nextStep: "Try again in the morning." }),
};

describe("ObserveHostEvent with a contributed guard", () => {
  test("runs the contributed check at its host point, through the same guard standing", async () => {
    const host = {
      ...hostOver(reviewed),
      rules: accept(composeGuards({ ...NO_HOST_RULES, "user-prompt": [quietAtPrompt] })).host,
    };

    expect(
      await observeHostEventUseCase(host).observe({
        point: "user-prompt",
        session: CHAT,
        at: NOW,
        evidence: typedTurn(NOW),
      }),
    ).toMatchObject({ verdict: { kind: "block", refusal: { guard: quietHours } } });
  });

  test("the person's switch lifts a contributed guard like a core one", async () => {
    const host = {
      ...hostOver({
        ...reviewed,
        guardSwitches: [{ guard: quietHours.id, state: "off", personWords: "ignore quiet hours", at: NOW }],
      }),
      rules: accept(composeGuards({ ...NO_HOST_RULES, "user-prompt": [quietAtPrompt] })).host,
    };

    expect(
      await observeHostEventUseCase(host).observe({
        point: "user-prompt",
        session: CHAT,
        at: NOW,
        evidence: typedTurn(NOW),
      }),
    ).toMatchObject({ verdict: { kind: "allow" } });
  });
});
