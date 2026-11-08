import { describe, expect, test } from "bun:test";
import { claudeProjectionFixture } from "./claude-projection.fixture.ts";

describe("claudeProjectionFixture", () => {
  test("projects for the Claude host with no findings", () => {
    expect(claudeProjectionFixture).toMatchObject({
      host: { distribution: "claude", directory: ".claude" },
      findings: [],
    });
  });

  test("places each file under .claude, apart from the root gitignore", () => {
    expect(claudeProjectionFixture.files.map((file) => file.path)).toEqual<string[]>([
      ".claude/agents/aidlc-developer-agent.md",
      ".claude/aidlc-common/agents/aidlc-developer-agent.md",
      ".claude/skills/aidlc-code-generation/SKILL.md",
      ".claude/skills/aidlc-feature/SKILL.md",
      ".claude/aidlc-common/stages/construction/code-generation.md",
      ".claude/knowledge/aidlc-developer-agent/code-generation-guide.md",
      ".claude/settings.json",
      ".claude/CLAUDE.md",
      ".gitignore",
    ]);
  });

  test("covers rendered, method-source and harness-authored origins", () => {
    expect(claudeProjectionFixture.files.map((file) => file.origin)).toMatchObject([
      { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
      { kind: "method-source", path: "aidlc-common/agents/aidlc-developer-agent.md" },
      { kind: "rendered", concept: "stage-command", name: "code-generation" },
      { kind: "rendered", concept: "scope-command", name: "feature" },
      { kind: "method-source", path: "aidlc-common/stages/construction/code-generation.md" },
      {
        kind: "method-source",
        path: "knowledge/aidlc-developer-agent/code-generation-guide.md",
      },
      { kind: "rendered", concept: "hook-registration", name: "settings" },
      { kind: "rendered", concept: "onboarding", name: "CLAUDE.md" },
      { kind: "harness-authored", source: "harness/claude/dot-gitignore" },
    ]);
  });

  test("renders the developer agent as a Claude subagent file", () => {
    expect<readonly object[]>(claudeProjectionFixture.files).toContainEqual({
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
    });
  });
});
