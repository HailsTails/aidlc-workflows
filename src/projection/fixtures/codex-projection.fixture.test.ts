import { describe, expect, test } from "bun:test";
import { codexProjectionFixture } from "./codex-projection.fixture.ts";

const PROJECTED_FILES = [
  {
    path: ".codex/agents/aidlc-developer-agent.toml",
    origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
  },
  {
    path: ".agents/skills/aidlc-code-generation/SKILL.md",
    origin: { kind: "rendered", concept: "stage-command", name: "code-generation" },
  },
  {
    path: ".agents/skills/aidlc/SKILL.md",
    origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc" },
  },
  {
    path: ".codex/aidlc-rules/aidlc.md",
    origin: { kind: "harness-authored", source: "harness/codex/rules-aidlc.md" },
  },
  {
    path: ".codex/hooks.json",
    origin: { kind: "rendered", concept: "hook-registration", name: "hooks.json" },
  },
  {
    path: "AGENTS.md",
    origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
  },
  {
    path: ".codex/onboarding.md",
    origin: { kind: "rendered", concept: "onboarding", name: "onboarding.md" },
  },
];

const DEVELOPER_AGENT_FILE = {
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
};

describe("codexProjectionFixture", () => {
  test("projects for the Codex host with no findings", () => {
    expect(codexProjectionFixture).toMatchObject({
      host: { distribution: "codex", directory: ".codex" },
      findings: [],
    });
  });

  test("places files under .codex, the shared .agents skills folder and the root", () => {
    expect(codexProjectionFixture.files).toMatchObject(PROJECTED_FILES);
  });

  test("renders the developer agent as a Codex TOML agent", () => {
    expect<readonly object[]>(codexProjectionFixture.files).toContainEqual(DEVELOPER_AGENT_FILE);
  });
});
