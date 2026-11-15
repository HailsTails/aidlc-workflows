import { brand } from "../../kernel/brand.ts";
import type { OnboardingContext, OnboardingPermissions } from "../../projection/domain/onboarding-context.ts";
import { expect, test } from "bun:test";
import { CODEX_ONBOARDING_FILLS, codexOnboardingFills } from "./onboarding-fills.ts";

const nativeContext: OnboardingContext = { channel: "native", permissions: brand<OnboardingPermissions>({
  policy: "prefix-only", prefix: "aidlc engine",
}) };

test("Codex retains its invocation and empty optional onboarding slots", () => {
  expect(CODEX_ONBOARDING_FILLS.invoke).toBe("$aidlc");
  expect(CODEX_ONBOARDING_FILLS.slots["structure_extra"]).toBe("");
  expect(CODEX_ONBOARDING_FILLS.slots["sections_after_resumption"]).toBe("");
  expect(CODEX_ONBOARDING_FILLS.slots["frontmatter"]).toBeUndefined();
});

test("Codex onboarding retains the native agent identity and guide", () => {
  expect(CODEX_ONBOARDING_FILLS.slots["agents_note"])
    .toBe("On Codex all 14 expert roles are transposed into `.codex/agents/` TOMLs " +
      "(the `/aidlc` session reads the role `.md` bodies as prose); the four delegated stages " +
      "(2.1 pipeline, 2.2 subagent, 2.4 mob, 3.5 subagent), reviewer passes, and composer requests " +
      "run through Codex subagent roles.");
  expect(CODEX_ONBOARDING_FILLS.slots["sections_before_resumption"])
    .toEndWith("The Codex-specific guide (prerequisites, trust pre-seed, provider config, the git-repo requirement) " +
      "is https://awslabs.github.io/aidlc-workflows/guide/harnesses/codex-cli/.\n");
});

test("copy onboarding retains its exact authored runtime prerequisite", () => {
  expect(codexOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).toContain("- **bun**: Required for CLI tools and hook scripts (state management, audit logging, jump orchestration). Install via `curl -fsSL https://bun.sh/install | bash`. On Windows: `npm install -g bun` or `powershell -c \"irm bun.sh/install.ps1 | iex\"`. Its hooks run with the PATH of the terminal you start `codex` from, so `bun --version` working there is enough. If Codex runs inside an IDE opened from the dock or a desktop icon and its hooks do not run, run `bun .codex/tools/aidlc.ts doctor` in such a terminal: its Runtime hook PATH row names the directory to add and where, so dock launches work after a restart. Until then, open the IDE from that terminal.");
  expect(codexOnboardingFills({ channel: "copy" }).slots["prereq_bullets"]).not.toContain("- **Runtime**:");
});

test("native onboarding authors the frozen runtime guidance before interpolation", () => {
  expect(codexOnboardingFills(nativeContext).slots["prereq_bullets"]).toContain("- **Runtime**: Framework commands run through `aidlc`; keep that command and its runtime available. If `aidlc` is not found in this tool, give the person both fixes in one line, then end your turn without installing anything or working around it: if AI-DLC was installed while this tool was open, quit the tool fully and reopen it (a new tab or reloaded window is not enough); otherwise the installer's bin folder is not on PATH (an install with `-NoModifyPath`, or a Unix install whose PATH line was not applied), so add the folder the installer printed to PATH, or rerun the installer without `-NoModifyPath`, then reopen the tool.");
  expect(codexOnboardingFills(nativeContext).slots["prereq_bullets"]).not.toContain("- **bun**:");
});
