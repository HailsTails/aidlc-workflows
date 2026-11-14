import { describe, expect, test } from "bun:test";
import { RuleFileSchema } from "./rule-file.ts";

const READABLE_RULES = [
  {
    shape: "a rule paired with a sensor and its lifecycle",
    text: `{
      "pairing": "aidlc-required-sections", "status": "active", "stale_after": "2026-12-31"
    }`,
  },
  { shape: "a rule declared feedforward-only", text: '{ "pairing": "feedforward-only" }' },
  { shape: "a rule file with no frontmatter fields", text: "{}" },
];

const UNNAMED_PAIRING = '{ "pairing": "required-sections" }';

describe("RuleFileSchema", () => {
  test.each(READABLE_RULES)("reads $shape", ({ text }) => {
    expect(RuleFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(text));
  });

  test("refuses a pairing that does not name a sensor manifest", () => {
    expect(RuleFileSchema.safeParse(JSON.parse(UNNAMED_PAIRING))).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["pairing"] }] },
    });
  });
});
