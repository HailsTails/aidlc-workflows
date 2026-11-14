import { expect, test } from "bun:test";
import { KIRO_IDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("Kiro IDE retains its native always-included onboarding frontmatter and invocation", () => {
  expect(KIRO_IDE_ONBOARDING_FILLS.invoke).toBe("/aidlc");
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["frontmatter"]).toBe("---\ninclusion: always\n---");
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["prereq_bullets_tail"]).toBe("");
});

test("Kiro IDE onboarding keeps the current CLI engine and IDE setup instructions", () => {
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["title_block"]).toContain("Kiro");
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["prereq_bullets"]).toContain("kiro-cli --v3");
});
