import { expect, test } from "bun:test";
import { KIRO_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("Kiro keeps its literal invocation and empty optional slots", () => {
  expect(KIRO_ONBOARDING_FILLS.invoke).toBe("/aidlc");
  expect(KIRO_ONBOARDING_FILLS.slots["prereq_bullets_tail"]).toBe("");
  expect(KIRO_ONBOARDING_FILLS.slots["structure_extra"]).toBe("");
  expect(KIRO_ONBOARDING_FILLS.slots["sections_after_resumption"]).toBe("");
});

test("Kiro's native onboarding keeps its identity and delegated-agent facts", () => {
  expect(KIRO_ONBOARDING_FILLS.slots["title_block"]).toStartWith("# AI-DLC on Kiro CLI\n\nThis project uses AI-DLC");
  expect(KIRO_ONBOARDING_FILLS.slots["agents_note"]).toBe(
    "On Kiro the `/aidlc` session runs from `agents/aidlc.json`; all 14 expert roles have JSON configs, and the four delegated stages (2.1 pipeline, 2.2 subagent, 2.4 mob, 3.5 subagent), reviewer passes, and composer requests run through the Kiro `subagent` tool, while inline-stage personas are adopted in-context.",
  );
});

test("Kiro CLI (V2) onboarding points at its section of the one Kiro guide and refreshes by harness name", () => {
  expect(KIRO_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("The Kiro-specific guide (install, what differs, the live journey test) is the Kiro CLI (V2) " +
      "section of the Kiro guide, `docs/guide/harnesses/kiro.md#kiro-cli-v2`.");
  expect(KIRO_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("refresh each harness tree with `{{INVOKE}} config --harness <name>` (`claude`, `kiro-v2`)");
});
