import { describe, expect, test } from "bun:test";
import { claudeProjectionFixture } from "./claude-projection.fixture.ts";

const PROJECTED_FILES = [
  {
    path: ".claude/agents/aidlc-developer-agent.md",
    origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
  },
  {
    path: ".claude/aidlc-common/agents/aidlc-developer-agent.md",
    origin: { kind: "method-source", path: "aidlc-common/agents/aidlc-developer-agent.md" },
  },
  {
    path: ".claude/skills/aidlc-code-generation/SKILL.md",
    origin: { kind: "rendered", concept: "stage-command", name: "code-generation" },
  },
  {
    path: ".claude/skills/aidlc-feature/SKILL.md",
    origin: { kind: "rendered", concept: "scope-command", name: "feature" },
  },
  {
    path: ".claude/aidlc-common/stages/construction/code-generation.md",
    origin: { kind: "method-source", path: "aidlc-common/stages/construction/code-generation.md" },
  },
  {
    path: ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md",
    origin: {
      kind: "method-source",
      path: "knowledge/aidlc-developer-agent/code-generation-guide.md",
    },
  },
  {
    path: ".claude/settings.json",
    origin: { kind: "rendered", concept: "hook-registration", name: "settings" },
  },
  {
    path: ".claude/CLAUDE.md",
    origin: { kind: "rendered", concept: "onboarding", name: "CLAUDE.md" },
  },
  {
    path: ".gitignore",
    origin: { kind: "harness-authored", source: "harness/claude/dot-gitignore" },
  },
];

const DEVELOPER_AGENT_FILE = {
  path: ".claude/agents/aidlc-developer-agent.md",
  content: {
    kind: "text",
    text:
      "---\nname: aidlc-developer-agent\ndescription: Senior developer responsible for " +
      "code generation, reverse engineering, and data modelling.\ndisallowedTools: Task\n" +
      "model: inherit\n---\n\n# Developer Agent\n",
  },
  mode: "regular",
  origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
  availability: "always",
};

describe("claudeProjectionFixture", () => {
  test("projects for the Claude host with no findings", () => {
    expect(claudeProjectionFixture).toMatchObject({
      host: { distribution: "claude", directory: ".claude" },
      findings: [],
    });
  });

  test("places rendered, method-source and harness-authored files", () => {
    expect(claudeProjectionFixture.files).toMatchObject(PROJECTED_FILES);
  });

  test("renders the developer agent as a Claude subagent file", () => {
    expect<readonly object[]>(claudeProjectionFixture.files).toContainEqual(DEVELOPER_AGENT_FILE);
  });
});
