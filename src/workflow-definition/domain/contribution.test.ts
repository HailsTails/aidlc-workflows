import { describe, expect, test } from "bun:test";
import { RULE_LEVELS } from "./contribution.ts";

describe("RULE_LEVELS", () => {
  test("lists the levels a plugin's rules can join, from org to project", () => {
    expect(RULE_LEVELS).toEqual(["org", "team", "project"]);
  });
});
