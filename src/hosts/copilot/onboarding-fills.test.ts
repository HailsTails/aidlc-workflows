import { brand } from "../../kernel/brand.ts";
import type { OnboardingContext, OnboardingPermissions } from "../../projection/domain/onboarding-context.ts";
import { expect, test } from "bun:test";
import { COPILOT_ONBOARDING_FILLS, copilotOnboardingFills } from "./onboarding-fills.ts";

const nativeContext: OnboardingContext = { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: "prefix-only", prefix: "aidlc engine",
}) };

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

test("Copilot onboarding links its guide on the documentation site", () => {
  expect(COPILOT_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("The Copilot-specific guide (install, what differs, verification) " +
      "is https://awslabs.github.io/aidlc-workflows/guide/harnesses/copilot/.");
});

test("copy onboarding retains the literal Copilot Bun prerequisite", () => {
  expect(copilotOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).toContain("- **bun**: Required for the CLI tools and hook scripts (tracking progress, writing the decision log, deciding what runs next). Install via `curl -fsSL https://bun.sh/install | bash`. `bun` must be on your PATH for the shells Copilot spawns.");
  expect(copilotOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).not.toContain("- **Runtime**:");
});

test("native onboarding authors its runtime guidance before interpolation", () => {
  expect(copilotOnboardingFills(nativeContext).slots["prereq_bullets"]).toContain("- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.");
  expect(copilotOnboardingFills(nativeContext).slots["prereq_bullets"]).not.toContain("- **bun**:");
  expect(copilotOnboardingFills(nativeContext).invoke).toBe("/aidlc");
});
