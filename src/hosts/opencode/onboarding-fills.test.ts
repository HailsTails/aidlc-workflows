import { expect, test } from "bun:test";
import { OPENCODE_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("OpenCode keeps its invocation and empty optional onboarding slots", () => {
  expect(OPENCODE_ONBOARDING_FILLS.invoke).toBe("/aidlc");
  expect(OPENCODE_ONBOARDING_FILLS.slots["prereq_bullets_tail"]).toBe("");
  expect(OPENCODE_ONBOARDING_FILLS.slots["sections_after_resumption"]).toBe("");
  expect(OPENCODE_ONBOARDING_FILLS.slots["frontmatter"]).toBeUndefined();
});

test("OpenCode onboarding retains its separate engine directory and guide", () => {
  expect(OPENCODE_ONBOARDING_FILLS.slots["title_block"])
    .toContain("The workspace shell ships in `.aidlc/` (no setup command)");
  expect(OPENCODE_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toEndWith("The opencode-specific guide (install, what differs, verification) " +
      "is `docs/guide/harnesses/opencode.md`.\n");
});
