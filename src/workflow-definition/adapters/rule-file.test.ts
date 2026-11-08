import { describe, expect, test } from "bun:test";
import { RuleFileSchema, type RuleFile } from "./rule-file.ts";

const pairedRule: RuleFile = {
  pairing: "aidlc-required-sections",
  status: "active",
  stale_after: "2026-12-31",
};

describe("RuleFileSchema", () => {
  test("reads a rule paired with a sensor and its lifecycle", () => {
    expect(RuleFileSchema.parse(pairedRule)).toEqual(pairedRule);
  });

  test("reads a rule declared feedforward-only", () => {
    expect(RuleFileSchema.parse({ pairing: "feedforward-only" })).toEqual({
      pairing: "feedforward-only",
    });
  });

  test("reads a rule file with no frontmatter fields", () => {
    expect(RuleFileSchema.parse({})).toEqual({});
  });

  test("refuses a pairing that does not name a sensor manifest", () => {
    expect(RuleFileSchema.safeParse({ pairing: "required-sections" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["pairing"] }] },
    });
  });
});
