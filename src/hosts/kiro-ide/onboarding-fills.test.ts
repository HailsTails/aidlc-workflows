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

test("Kiro onboarding names Approve for me, the one Kiro guide and the refresh by harness name", () => {
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["prereq_bullets"])
    .toContain("on Default, Kiro asks you to approve each command AI-DLC runs, unless Kiro's Approve for me mode is on");
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("is `docs/guide/harnesses/kiro.md`, all but its Kiro CLI (V2) section, which is the other Kiro distribution's.");
  expect(KIRO_IDE_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("refresh each harness tree with `{{INVOKE}} config --harness <name>` (`claude`, `kiro`)");
});
