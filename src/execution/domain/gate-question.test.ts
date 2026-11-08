import { describe, expect, test } from "bun:test";
import { STAGE_GATE_OPTIONS, stageGateQuestion } from "./gate-question.ts";

describe("stage gate question", () => {
  test("names the stage in the person's words", () => {
    expect(stageGateQuestion({ displayName: "Requirements Analysis" })).toBe(
      "Requirements Analysis is ready for your decision. How would you like to go on?",
    );
  });

  test("offers approve, request changes and stop, each with what it means", () => {
    expect(STAGE_GATE_OPTIONS).toEqual([
      { label: "Approve", meaning: "The work is right; carry on to the next stage." },
      {
        label: "Request Changes",
        meaning: "Say what to change; the stage is revised and asked again.",
      },
      { label: "Stop for now", meaning: "Park the work here; pick it up again whenever you like." },
    ]);
  });
});
