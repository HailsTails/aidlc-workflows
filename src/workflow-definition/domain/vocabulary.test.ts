import { describe, expect, test } from "bun:test";
import {
  CEREMONY_KEYS,
  COLLABORATION_MODES,
  DEPTHS,
  GUARD_POLICIES,
  PHASES,
  PROJECT_TYPES,
  REVIEW_CLASSES,
  TIERS,
  UNIT_KINDS,
} from "./vocabulary.ts";

describe("method vocabulary", () => {
  test("PHASES lists the five phases in the order work moves through them", () => {
    expect(PHASES).toEqual([
      "initialization",
      "ideation",
      "inception",
      "construction",
      "operation",
    ]);
  });

  test("UNIT_KINDS lists every kind of unit of work", () => {
    expect(UNIT_KINDS).toEqual(["service", "spec", "ui", "packaging", "library"]);
  });

  test("TIERS lists the model tiers from most to least judgement", () => {
    expect(TIERS).toEqual(["judgment", "balanced", "templated"]);
  });

  test("REVIEW_CLASSES lists the review classes from none to adversarial", () => {
    expect(REVIEW_CLASSES).toEqual(["none", "advisory", "adversarial"]);
  });

  test("GUARD_POLICIES lists the guard policies from strict to off", () => {
    expect(GUARD_POLICIES).toEqual(["strict", "relaxed", "off"]);
  });

  test("CEREMONY_KEYS lists every ceremony a scope can switch", () => {
    expect(CEREMONY_KEYS).toEqual([
      "sensors",
      "learnings",
      "summary-confirmation",
      "plan-approval",
      "collaborators",
    ]);
  });

  test("DEPTHS lists the depths from minimal to comprehensive", () => {
    expect(DEPTHS).toEqual(["minimal", "standard", "comprehensive"]);
  });

  test("PROJECT_TYPES lists brownfield and greenfield", () => {
    expect(PROJECT_TYPES).toEqual(["brownfield", "greenfield"]);
  });

  test("COLLABORATION_MODES lists every way agents work a stage", () => {
    expect(COLLABORATION_MODES).toEqual(["inline", "subagent", "pipeline", "mob", "agent-team"]);
  });
});
