import { describe, expect, test } from "bun:test";
import { at } from "../../kernel/fixtures/values.fixture.ts";
import { stageOf, unitOf } from "../fixtures/workflow-record.fixture.ts";
import { CORE_GUARDS } from "./guard.ts";
import { presenceStop, transitionStop } from "./guard-stops.ts";

const NEXT = "Ask the engine for the next step and carry that out.";

describe("transitionStop", () => {
  test("names the stage, its progress and what the step needs", () => {
    expect(
      transitionStop({
        kind: "stage-out-of-order",
        at: { stage: stageOf("code-generation"), unit: unitOf("ledger"), progress: "pending" },
        allowedFrom: ["in-progress", "revising"],
      }),
    ).toEqual({
      guard: CORE_GUARDS.stateTransition,
      reason: "code-generation for Unit ledger is pending; that step needs it in-progress or revising.",
      nextStep: NEXT,
    });
  });

  test("names the work's status when it is not the one the step needs", () => {
    expect(
      transitionStop({
        kind: "workflow-status",
        status: { kind: "parked", since: at("2026-11-08T10:00:00Z") },
        needed: "running",
      }).reason,
    ).toBe("This work is parked; that step needs it running.");
  });

  test("names a stage this work does not run", () => {
    expect(
      transitionStop({ kind: "stage-not-in-plan", stage: stageOf("build-and-test"), unit: null })
        .reason,
    ).toBe("build-and-test is not a stage this work runs.");
  });

  test("lists the stages still unfinished", () => {
    expect(
      transitionStop({
        kind: "stages-unfinished",
        remaining: [
          { stage: stageOf("application-design"), unit: null, progress: "pending" },
          { stage: stageOf("code-generation"), unit: unitOf("ledger"), progress: "revising" },
        ],
      }).reason,
    ).toBe(
      "These stages are not finished yet: application-design, code-generation for Unit ledger.",
    );
  });
});

describe("presenceStop", () => {
  test.each([
    {
      gate: { kind: "stage", stage: stageOf("requirements-analysis"), unit: null },
      place: "the requirements-analysis gate",
    },
    {
      gate: { kind: "plan-approval", stage: stageOf("code-generation"), unit: unitOf("ledger") },
      place: "the plan approval for code-generation for Unit ledger",
    },
  ] as const)("stops at $place until the person replies", ({ gate, place }) => {
    expect(presenceStop(gate)).toEqual({
      guard: CORE_GUARDS.humanPresence,
      reason: `No reply the person typed has reached ${place} since it opened.`,
      nextStep: "Wait for the person to type their choice, then record it.",
    });
  });
});
