import { expect, test } from "bun:test";
import { OPENCODE_ONBOARDING_FILLS, openCodeOnboardingFills } from "./onboarding-fills.ts";

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
      "is https://awslabs.github.io/aidlc-workflows/guide/harnesses/opencode/.\n");
});

test("OpenCode says its session hands work off without naming fixed delegated stages", () => {
  expect(OPENCODE_ONBOARDING_FILLS.slots["agents_note"])
    .toEndWith("the `/aidlc` session takes on those roles itself for most stages and hands work off via the `task` tool.");
});

test("copy onboarding retains its exact authored runtime prerequisite", () => {
  expect(openCodeOnboardingFills("copy").slots["prereq_bullets"]).toContain("- **bun**: Required for the CLI tools and hook scripts (tracking progress, writing the decision log, deciding what runs next). Install via `curl -fsSL https://bun.sh/install | bash`. `bun` must be on your PATH for the shells opencode spawns; the AIDLC adapter plugin also probes `~/.bun/bin/bun` directly.");
  expect(openCodeOnboardingFills("copy").slots["prereq_bullets"]).not.toContain("- **Runtime**:");
});

test("native onboarding authors the frozen runtime guidance before interpolation", () => {
  expect(openCodeOnboardingFills("native").slots["prereq_bullets"]).toContain("- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.");
  expect(openCodeOnboardingFills("native").slots["prereq_bullets"]).not.toContain("- **bun**:");
});
