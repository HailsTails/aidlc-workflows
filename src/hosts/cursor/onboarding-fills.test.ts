import { brand } from "../../kernel/brand.ts";
import { prepareOnboardingContext, type OnboardingPermissions } from "../../projection/domain/onboarding-context.ts";
import { expect, test } from "bun:test";
import { CURSOR_ONBOARDING_FILLS, cursorOnboardingFills } from "./onboarding-fills.ts";

const nativeContext = prepareOnboardingContext({ context: { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: "exact-reads", prefix: "aidlc engine",
}) }, skeleton: "" });

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

test("Cursor onboarding links its guide on the documentation site and names no fixed delegated stages", () => {
  expect(CURSOR_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toContain("The Cursor-specific guide (install, what differs, verification) " +
      "is https://awslabs.github.io/aidlc-workflows/guide/harnesses/cursor/.");
  expect(CURSOR_ONBOARDING_FILLS.slots["agents_note"])
    .toContain("the `/aidlc` session takes on those roles itself for most stages and hands work off via the `task` tool. ");
});

test("copy onboarding keeps its exact Bun prerequisite before interpolation", () => {
  const fills = cursorOnboardingFills({ channel: "copy" });
  expect(fills.slots["prereq_bullets"]).toContain("- **bun**: Required for the CLI tools and hook scripts (tracking progress, writing the decision log, deciding what runs next). Install via `curl -fsSL https://bun.sh/install | bash`. `bun` must be on your PATH for the shells Cursor spawns.");
  expect(fills.slots["prereq_bullets"]).not.toContain("- **Runtime**:");
});

test("native onboarding owns the runtime prerequisite before template serialization", () => {
  const fills = cursorOnboardingFills(nativeContext);
  expect(fills.slots["prereq_bullets"]).toContain("- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.");
  expect(fills.slots["prereq_bullets"]).not.toContain("- **bun**:");
  expect(fills.invoke).toBe("/aidlc");
});
