import { expect, test } from "bun:test";
import { COPILOT_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("Copilot keeps its invocation and empty optional onboarding slots", () => {
  expect(COPILOT_ONBOARDING_FILLS.invoke).toBe("/aidlc");
  expect(COPILOT_ONBOARDING_FILLS.slots["prereq_bullets_tail"]).toBe("");
  expect(COPILOT_ONBOARDING_FILLS.slots["structure_extra"]).toBe("");
  expect(COPILOT_ONBOARDING_FILLS.slots["frontmatter"]).toBeUndefined();
});

test("Copilot onboarding retains its dual-surface identity and native memory imports", () => {
  expect(COPILOT_ONBOARDING_FILLS.slots["title_block"])
    .toContain("**GitHub Copilot harness** (one install serves Copilot CLI and VS Code agent mode)");
  expect(COPILOT_ONBOARDING_FILLS.slots["sections_after_resumption"])
    .toEndWith("@aidlc/active-memory/phases/construction.md\n@aidlc/active-memory/phases/operation.md\n");
});
