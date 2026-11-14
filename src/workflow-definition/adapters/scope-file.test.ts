import { describe, expect, test } from "bun:test";
import { ScopeFileSchema } from "./scope-file.ts";

const FEATURE_SCOPE_FIELDS = `
  "name": "feature", "depth": "Standard", "keywords": [],
  "description": "Full lifecycle for new features, practical depth",
  "skeleton": "on", "runner": "true", "guard_policy": "off", "sensors": "on",
  "learnings": "on", "summary_confirmation": "on", "plan_approval": "on", "collaborators": "off"`;

const READABLE_SCOPES = [
  { shape: "a core scope with every ceremony set", text: `{${FEATURE_SCOPE_FIELDS} }` },
  {
    shape: "a scope for existing code with a review cap",
    text: `{
      "name": "bugfix", "depth": "Minimal", "keywords": ["fix", "bug", "broken", "bugfix"],
      "description": "Fix a specific bug", "skeleton": "off", "existing_code": "true",
      "runner": "true", "review_cap": "advisory", "guard_policy": "off", "sensors": "on",
      "learnings": "off", "summary_confirmation": "off", "plan_approval": "on",
      "collaborators": "off"
    }`,
  },
  {
    shape: "a plugin scope",
    text: `{
      "name": "test-pro-validation", "plugin": "test-pro", "depth": "Comprehensive",
      "keywords": ["validation", "test validation", "regression validation"],
      "description": "Run the test-pro validation stages", "skeleton": "off", "runner": "true"
    }`,
  },
  {
    shape: "a plugin scope that runs stages of the plugin it builds on",
    text: `{
      "name": "acme-quick", "plugin": "acme-lite", "depth": "Minimal", "keywords": [],
      "description": "Run the base plugin's intent and code stages", "include_stages": [
        "acme-1-intent-capture", "acme-3-code-generation"
      ]
    }`,
  },
];

const REFUSED_SCOPES = [
  {
    shape: "a misspelt key",
    text: `{${FEATURE_SCOPE_FIELDS}, "guard_polcy": "off" }`,
    issues: [{ code: "unrecognized_keys", keys: ["guard_polcy"], path: [] }],
  },
  {
    shape: "a depth written in lower case",
    text: '{ "name": "feature", "depth": "standard", "keywords": [], "description": "Feature" }',
    issues: [{ code: "invalid_value", path: ["depth"] }],
  },
  {
    shape: "a ceremony switch that is not on or off",
    text: `{
      "name": "feature", "depth": "Standard", "keywords": [], "description": "Feature",
      "sensors": "true"
    }`,
    issues: [{ code: "invalid_value", path: ["sensors"] }],
  },
  {
    shape: "a review cap that is not a review class",
    text: `{
      "name": "bugfix", "depth": "Minimal", "keywords": [],
      "description": "Bugfix", "review_cap": "strict"
    }`,
    issues: [{ code: "invalid_value", path: ["review_cap"] }],
  },
  {
    shape: "a name with a space",
    text: '{ "name": "new feature", "depth": "Standard", "keywords": [], "description": "New" }',
    issues: [{ code: "invalid_format", path: ["name"] }],
  },
];

describe("ScopeFileSchema", () => {
  test.each(READABLE_SCOPES)("reads $shape", ({ text }) => {
    expect(ScopeFileSchema.parse(JSON.parse(text))).toEqual(JSON.parse(text));
  });

  test.each(REFUSED_SCOPES)("refuses $shape", ({ text, issues }) => {
    expect(ScopeFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
