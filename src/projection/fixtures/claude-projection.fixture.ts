import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { Projection } from "../domain/projection.ts";
import { methodPath, text } from "./values.fixture.ts";

export const claudeProjectionFixture: Projection = {
  host: host("claude", ".claude"),
  files: [
    {
      path: path(".claude/agents/aidlc-developer-agent.md"),
      content: text([
        "---",
        "name: aidlc-developer-agent",
        "description: Senior developer responsible for code generation, reverse engineering, " +
          "and data modelling.",
        "disallowedTools: Task",
        "model: inherit",
        "---",
        "",
        "# Developer Agent",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
      availability: "always",
    },
    {
      path: path(".claude/aidlc-common/agents/aidlc-developer-agent.md"),
      content: text([
        "---",
        "name: aidlc-developer-agent",
        "display_name: Developer Agent",
        "tier: balanced",
        "---",
        "",
        "# Developer Agent",
      ]),
      executable: false,
      origin: {
        kind: "method-source",
        path: methodPath("agent", "aidlc-developer-agent.md"),
      },
      availability: "always",
    },
    {
      path: path(".claude/skills/aidlc-code-generation/SKILL.md"),
      content: text([
        "---",
        "name: aidlc-code-generation",
        "description: Run AI-DLC stage 3.5 Code Generation",
        "disable-model-invocation: true",
        "---",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "stage-command", name: "code-generation" },
      availability: "always",
    },
    {
      path: path(".claude/skills/aidlc-feature/SKILL.md"),
      content: text([
        "---",
        "name: aidlc-feature",
        "description: Run the feature scope",
        "disable-model-invocation: true",
        "---",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "scope-command", name: "feature" },
      availability: "always",
    },
    {
      path: path(".claude/aidlc-common/stages/construction/code-generation.md"),
      content: text(["---", "slug: code-generation", "phase: construction", "---"]),
      executable: false,
      origin: {
        kind: "method-source",
        path: methodPath("stage", "construction/code-generation.md"),
      },
      availability: "always",
    },
    {
      path: path(".claude/knowledge/aidlc-developer-agent/code-generation-guide.md"),
      content: text(["# Code Generation Guide"]),
      executable: false,
      origin: {
        kind: "method-source",
        path: methodPath("knowledge", "aidlc-developer-agent/code-generation-guide.md"),
      },
      availability: "always",
    },
    {
      path: path(".claude/settings.json"),
      content: text([
        "{",
        '  "hooks": {',
        '    "UserPromptSubmit": [{ "hooks": [{ "type": "command", ' +
          '"command": "aidlc engine hook record-human-turn" }] }]',
        "  }",
        "}",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "hook-registration", name: "settings" },
      availability: "always",
    },
    {
      path: path(".claude/CLAUDE.md"),
      content: text(["# AI-DLC", "", "Type `/aidlc` to start."]),
      executable: false,
      origin: { kind: "rendered", concept: "onboarding", name: "CLAUDE.md" },
      availability: "always",
    },
    {
      path: path(".gitignore"),
      content: text(["# >>> aidlc gitignore", "aidlc/**/.aidlc-*", "# <<< aidlc gitignore"]),
      executable: false,
      origin: { kind: "harness-authored", source: source("harness/claude/dot-gitignore") },
      availability: "always",
    },
  ],
  findings: [],
};
