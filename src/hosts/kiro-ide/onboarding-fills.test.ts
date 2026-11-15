import { brand } from "../../kernel/brand.ts";
import { prepareOnboardingContext, type OnboardingPermissions } from "../../projection/domain/onboarding-context.ts";
import { expect, test } from "bun:test";
import { KIRO_IDE_ONBOARDING_FILLS, kiroIdeOnboardingFills } from "./onboarding-fills.ts";

const nativeContext = prepareOnboardingContext({ context: { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: "exact-reads", prefix: "aidlc engine",
}) }, skeleton: "" });

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

test("copy onboarding retains its exact authored runtime prerequisite", () => {
  expect(kiroIdeOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).toContain("- **bun**: Required for the CLI tools and hook scripts (tracking progress, writing the decision log, deciding what runs next). Install via `curl -fsSL https://bun.sh/install | bash`. Its hooks run with the PATH Kiro was started with: Kiro CLI, or Kiro IDE opened from a terminal, uses that terminal's PATH, so `bun --version` working there is enough. If Kiro IDE is opened from the dock or a desktop icon and its hooks do not run, run `bun .kiro/tools/aidlc.ts doctor` in such a terminal: its Runtime hook PATH row names the directory to add and where, so dock launches work after a restart. Until then, open the IDE from that terminal.");
  expect(kiroIdeOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).not.toContain("- **Runtime**:");
});

test("native onboarding authors the frozen runtime guidance before interpolation", () => {
  expect(kiroIdeOnboardingFills(nativeContext).slots["prereq_bullets"]).toContain("- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.");
  expect(kiroIdeOnboardingFills(nativeContext).slots["prereq_bullets"]).not.toContain("- **bun**:");
});
