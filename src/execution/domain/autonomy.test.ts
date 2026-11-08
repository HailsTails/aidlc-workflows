import { describe, expect, test } from "bun:test";
import { RUNNING_RECORD, stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import { gateDecider, turnEnding } from "./autonomy.ts";
import type { Gate } from "./gate.ts";
import type { WorkflowSettings } from "./workflow-record.ts";

const stageGate: Gate = { kind: "stage", stage: stageOf("code-generation"), unit: null };
const planGate: Gate = { kind: "plan-approval", stage: stageOf("code-generation"), unit: unitOf("ledger") };

const gated: WorkflowSettings = RUNNING_RECORD.settings;
const autonomous: WorkflowSettings = { ...gated, constructionAutonomy: "autonomous" };

describe("gateDecider", () => {
  test.each([
    { gate: stageGate, phase: "construction", settings: autonomous, decider: "engine-may-decide" },
    { gate: stageGate, phase: "construction", settings: gated, decider: "person-decides" },
    { gate: stageGate, phase: "inception", settings: autonomous, decider: "person-decides" },
    { gate: planGate, phase: "construction", settings: autonomous, decider: "person-decides" },
  ] as const)("a $gate.kind gate in $phase: $decider", ({ gate, phase, settings, decider }) => {
    expect(gateDecider({ gate, phase, settings })).toBe(decider);
  });
});

describe("turnEnding", () => {
  test("gated work lets the conductor end its turn", () => {
    expect(turnEnding(gated)).toBe("may-end-turn");
  });

  test("autonomous Construction carries pending work on", () => {
    expect(turnEnding(autonomous)).toBe("carries-on");
  });
});
