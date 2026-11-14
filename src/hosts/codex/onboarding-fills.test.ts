import { expect, test } from "bun:test";
import { CODEX_ONBOARDING_FILLS } from "./onboarding-fills.ts";

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
      "is `docs/guide/harnesses/codex-cli.md`.\n");
});
