import { describe, expect, test } from "bun:test";
import { RENDERED_CONCEPTS } from "./projected-file.ts";

describe("RENDERED_CONCEPTS", () => {
  test("lists every concept a harness renders natively", () => {
    expect(RENDERED_CONCEPTS).toEqual([
      "agent",
      "stage-command",
      "scope-command",
      "session-skill",
      "orchestrator-skill",
      "settings",
      "hook-registration",
      "onboarding",
      "neutral-document",
      "host-data",
    ]);
  });
});
