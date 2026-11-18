import { describe, expect, test } from "bun:test";
import { GENERATED_GOLDEN_RECORDS } from "./golden-records.ts";
import { globMatcher } from "./glob.ts";

const isGeneratedRecord = globMatcher(GENERATED_GOLDEN_RECORDS);

describe("generated golden records", () => {
  test.each([
    "tests/golden/kiro.json",
    "tests/golden/plugin-marketplaces.json",
    "tests/golden/install/claude.json",
  ])("%s is a shared record", (path) => {
    expect(isGeneratedRecord(path)).toBe(true);
  });

  test.each([
    "tests/golden/runtime/record.ts",
    "tests/golden/runtime/scenarios/gate-approval.ts",
    "tests/golden/runtime/recorded/gate-approval.json",
    "tests/golden/install/helper.ts",
  ])("%s stays with its owner", (path) => {
    expect(isGeneratedRecord(path)).toBe(false);
  });
});
