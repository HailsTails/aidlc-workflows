import { describe, expect, it } from "vitest";
import { resolvedConfigSchema, ruleStateOf } from "./eslint-config-schema.ts";

const enabledFile = { rules: { "p/r": [2], "no-console": [1, {}] } };
const carvedFile = { rules: { "p/r": [0], "no-console": [1, {}] } };

describe("resolvedConfigSchema", () => {
  it("accepts a file's configuration whose rules are severity-first tuples", () => {
    expect(resolvedConfigSchema.safeParse(enabledFile)).toEqual({
      success: true,
      data: { rules: { "p/r": [2], "no-console": [1, {}] } },
    });
  });

  it("accepts a file's configuration turning a rule off at severity 0", () => {
    expect(resolvedConfigSchema.safeParse(carvedFile)).toEqual({
      success: true,
      data: { rules: { "p/r": [0], "no-console": [1, {}] } },
    });
  });

  it("accepts the undefined configuration of an ignored file", () => {
    expect(resolvedConfigSchema.safeParse(undefined)).toEqual({ success: true, data: undefined });
  });

  it("accepts a configuration with no rules key", () => {
    expect(resolvedConfigSchema.safeParse({ language: "js/js" })).toEqual({
      success: true,
      data: { language: "js/js" },
    });
  });

  it("keeps the configuration keys beside rules", () => {
    expect(
      resolvedConfigSchema.safeParse({ settings: { team: "platform" }, rules: { "p/r": [2] } }),
    ).toEqual({ success: true, data: { settings: { team: "platform" }, rules: { "p/r": [2] } } });
  });

  it.each([
    { label: "a word severity", entry: ["error"] },
    { label: "severity 3", entry: [3] },
    { label: "an empty entry", entry: [] },
    { label: "a bare severity", entry: 2 },
  ])("refuses a rule entry holding $label", ({ entry }) => {
    expect(resolvedConfigSchema.safeParse({ rules: { "p/r": entry } }).success).toBe(false);
  });

  it("refuses a null configuration", () => {
    expect(resolvedConfigSchema.safeParse(null).success).toBe(false);
  });
});

describe("ruleStateOf", () => {
  it("reads a rule configured at error as configured at severity 2", () => {
    expect(ruleStateOf({ resolved: { rules: { "p/r": [2], "no-console": [1, {}] } }, ruleId: "p/r" })).toEqual({
      state: "configured",
      severity: 2,
    });
  });

  it("reads a rule configured at warn with options as configured at severity 1", () => {
    expect(
      ruleStateOf({ resolved: { rules: { "p/r": [2], "no-console": [1, {}] } }, ruleId: "no-console" }),
    ).toEqual({ state: "configured", severity: 1 });
  });

  it("reads a rule turned off for the file as configured at severity 0", () => {
    expect(ruleStateOf({ resolved: { rules: { "p/r": [0], "no-console": [1, {}] } }, ruleId: "p/r" })).toEqual({
      state: "configured",
      severity: 0,
    });
  });

  it("reads a rule absent from the file's rules as rule-absent", () => {
    expect(ruleStateOf({ resolved: { rules: { "no-console": [1, {}] } }, ruleId: "p/r" })).toEqual({
      state: "rule-absent",
    });
  });

  it("reads a configuration with no rules key as rule-absent", () => {
    expect(ruleStateOf({ resolved: {}, ruleId: "p/r" })).toEqual({ state: "rule-absent" });
  });

  it("reads the undefined configuration of an ignored or unconfigured file as file-ignored", () => {
    expect(ruleStateOf({ resolved: undefined, ruleId: "p/r" })).toEqual({ state: "file-ignored" });
  });
});
