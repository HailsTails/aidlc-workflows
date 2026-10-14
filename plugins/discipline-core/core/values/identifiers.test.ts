import { describe, expect, it } from "vitest";
import {
  clauseIdSchema,
  disciplineIdSchema,
  mechanismIdSchema,
  ruleSetNameSchema,
} from "./identifiers.ts";

describe("ruleSetNameSchema", () => {
  it.each(["probe", "team-rules", "r2"])("accepts %j", (text) => {
    expect(ruleSetNameSchema.safeParse(text).success).toBe(true);
  });

  it.each([
    "",
    "Probe",
    "2rules",
    "-rules",
    "team_rules",
    "team rules",
    "team/rules",
  ])("refuses %j", (text) => {
    expect(ruleSetNameSchema.safeParse(text).success).toBe(false);
  });
});

describe("disciplineIdSchema", () => {
  it.each(["CD-14", "CD-7a", "PD-1", "ABCD-123"])("accepts %j", (text) => {
    expect(disciplineIdSchema.safeParse(text).success).toBe(true);
  });

  it.each([
    "",
    "cd-14",
    "C-14",
    "ABCDE-1",
    "CD-",
    "CD14",
    "CD-14ab",
    "CD-14A",
    "CD-x",
    "CD-14#no-class-syntax",
  ])("refuses %j", (text) => {
    expect(disciplineIdSchema.safeParse(text).success).toBe(false);
  });
});

describe("clauseIdSchema", () => {
  it.each(["no-class-syntax", "no-tmp-files", "a1"])("accepts %j", (text) => {
    expect(clauseIdSchema.safeParse(text).success).toBe(true);
  });

  it.each(["", "No-class", "1st-clause", "-clause", "no_class", "no class", "no#class"])(
    "refuses %j",
    (text) => {
      expect(clauseIdSchema.safeParse(text).success).toBe(false);
    },
  );
});

describe("mechanismIdSchema", () => {
  it.each(["walker", "eslint", "oxlint2"])("accepts %j", (text) => {
    expect(mechanismIdSchema.safeParse(text).success).toBe(true);
  });

  it.each(["", "ESLint", "2walker", "-walker", "type_script", "es lint", "walker/ts"])(
    "refuses %j",
    (text) => {
      expect(mechanismIdSchema.safeParse(text).success).toBe(false);
    },
  );
});
