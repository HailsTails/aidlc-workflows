import { expect, test } from "bun:test";
import { renderOnboarding } from "../../projection/domain/onboarding.ts";
import { CLAUDE_ONBOARDING_FILLS } from "./onboarding-fills.ts";

test("Claude fills supply the native entry and remove the empty optional section", () => {
  expect(renderOnboarding("Use {{SKILL_INVOKE}}.\n{{SLOT:structure_extra}}\n", CLAUDE_ONBOARDING_FILLS))
    .toEqual({ ok: true, value: "Use /aidlc.\n" });
});

test("Claude's local-settings fill leaves runtime invocation binding to its existing owner", () => {
  expect(renderOnboarding("{{SLOT:sections_after_resumption}}\n{{INVOKE}}\n", CLAUDE_ONBOARDING_FILLS))
    .toEqual({ ok: true, value: "## Local settings\n\n"
      + "The shipped .gitignore block also ignores `.claude/settings.local.json` "
      + "(per-machine Claude Code settings).\n{{INVOKE}}\n" });
});
