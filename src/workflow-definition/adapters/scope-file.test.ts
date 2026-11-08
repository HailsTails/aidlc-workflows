import { describe, expect, test } from "bun:test";
import { ScopeFileSchema, type ScopeFile } from "./scope-file.ts";

const featureScope: ScopeFile = {
  name: "feature",
  depth: "Standard",
  keywords: [],
  description: "Full lifecycle for new features, practical depth",
  skeleton: "on",
  runner: "true",
  guard_policy: "off",
  sensors: "on",
  learnings: "on",
  summary_confirmation: "on",
  plan_approval: "on",
  collaborators: "off",
};

const bugfixScope: ScopeFile = {
  name: "bugfix",
  depth: "Minimal",
  keywords: ["fix", "bug", "broken", "bugfix"],
  description: "Fix a specific bug",
  skeleton: "off",
  existing_code: "true",
  runner: "true",
  review_cap: "advisory",
  guard_policy: "off",
  sensors: "on",
  learnings: "off",
  summary_confirmation: "off",
  plan_approval: "on",
  collaborators: "off",
};

const pluginScope: ScopeFile = {
  name: "test-pro-validation",
  plugin: "test-pro",
  depth: "Comprehensive",
  keywords: ["validation", "test validation", "regression validation"],
  description: "Run the test-pro validation stages",
  skeleton: "off",
  runner: "true",
};

const extendingScope: ScopeFile = {
  name: "acme-quick",
  plugin: "acme-lite",
  depth: "Minimal",
  keywords: [],
  description: "Run the base plugin's intent and code stages",
  include_stages: ["acme-1-intent-capture", "acme-3-code-generation"],
};

describe("ScopeFileSchema", () => {
  test("reads a core scope with every ceremony set", () => {
    expect(ScopeFileSchema.parse(featureScope)).toEqual(featureScope);
  });

  test("reads a scope for existing code with a review cap", () => {
    expect(ScopeFileSchema.parse(bugfixScope)).toEqual(bugfixScope);
  });

  test("reads a plugin scope", () => {
    expect(ScopeFileSchema.parse(pluginScope)).toEqual(pluginScope);
  });

  test("reads a plugin scope that runs stages of the plugin it builds on", () => {
    expect(ScopeFileSchema.parse(extendingScope)).toEqual(extendingScope);
  });

  test("refuses a misspelt key", () => {
    expect(ScopeFileSchema.safeParse({ ...featureScope, guard_polcy: "off" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "unrecognized_keys", keys: ["guard_polcy"], path: [] }] },
    });
  });

  test("refuses a depth written in lower case", () => {
    expect(ScopeFileSchema.safeParse({ ...featureScope, depth: "standard" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["depth"] }] },
    });
  });

  test("refuses a ceremony switch that is not on or off", () => {
    expect(ScopeFileSchema.safeParse({ ...featureScope, sensors: "true" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["sensors"] }] },
    });
  });

  test("refuses a review cap that is not a review class", () => {
    expect(ScopeFileSchema.safeParse({ ...bugfixScope, review_cap: "strict" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: ["review_cap"] }] },
    });
  });

  test("refuses a name with a space", () => {
    expect(ScopeFileSchema.safeParse({ ...featureScope, name: "new feature" })).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: ["name"] }] },
    });
  });
});
