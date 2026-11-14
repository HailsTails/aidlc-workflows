import { expect, test } from "bun:test";
import { CURSOR_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("Cursor keeps its exact invocation, always-on frontmatter and empty optional slots", () => {
  expect(CURSOR_ONBOARDING_FILLS.invoke).toBe("/aidlc");
  expect(CURSOR_ONBOARDING_FILLS.slots["frontmatter"])
    .toBe("---\ndescription: AI-DLC onboarding for Cursor\nalwaysApply: true\n---");
  expect(CURSOR_ONBOARDING_FILLS.slots["prereq_bullets_tail"]).toBe("");
  expect(CURSOR_ONBOARDING_FILLS.slots["structure_extra"]).toBe("");
  expect(CURSOR_ONBOARDING_FILLS.slots["sections_after_resumption"]).toBe("");
});

test("Cursor onboarding preserves its identity and native shortcut instructions", () => {
  expect(CURSOR_ONBOARDING_FILLS.slots["title_block"]).toStartWith("# AI-DLC on Cursor\n\nThis project uses AI-DLC");
  expect(CURSOR_ONBOARDING_FILLS.slots["title_block"]).toContain("`/aidlc-status`, `/aidlc-jump --stage <slug>`");
});
