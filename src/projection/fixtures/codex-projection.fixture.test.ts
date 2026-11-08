import { describe, expect, test } from "bun:test";
import { codexProjectionFixture } from "./codex-projection.fixture.ts";

describe("codexProjectionFixture", () => {
  test("projects for the Codex host with no findings", () => {
    expect(codexProjectionFixture).toMatchObject({
      host: { distribution: "codex", directory: ".codex" },
      findings: [],
    });
  });

  test("places files under .codex, the shared .agents skills folder and the root", () => {
    expect(codexProjectionFixture.files.map((file) => file.path)).toEqual<string[]>([
      ".codex/agents/aidlc-developer-agent.toml",
      ".agents/skills/aidlc-code-generation/SKILL.md",
      ".agents/skills/aidlc/SKILL.md",
      ".codex/aidlc-rules/aidlc.md",
      ".codex/hooks.json",
      "AGENTS.md",
      ".codex/onboarding.md",
    ]);
  });

  test("records where each file came from", () => {
    expect(codexProjectionFixture.files.map((file) => file.origin)).toMatchObject([
      { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
      { kind: "rendered", concept: "stage-command", name: "code-generation" },
      { kind: "rendered", concept: "orchestrator-skill", name: "aidlc" },
      { kind: "harness-authored", source: "harness/codex/rules-aidlc.md" },
      { kind: "rendered", concept: "hook-registration", name: "hooks.json" },
      { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
      { kind: "rendered", concept: "onboarding", name: "onboarding.md" },
    ]);
  });

  test("renders the developer agent as a Codex TOML agent", () => {
    expect<readonly object[]>(codexProjectionFixture.files).toContainEqual({
      path: ".codex/agents/aidlc-developer-agent.toml",
      content: {
        kind: "text",
        text:
          'name = "aidlc-developer-agent"\n' +
          'description = "Senior developer responsible for code generation."\n' +
          'developer_instructions = """\n# Developer Agent\n"""\n',
      },
      mode: "regular",
      origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
      availability: "always",
    });
  });
});
