import { host, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { Projection } from "../domain/projection.ts";
import { methodPath, text } from "./values.fixture.ts";

export const claudeProjectionFixture = {
  host: host({ name: "claude", directory: ".claude" }),
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
      mode: "regular",
      origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
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
      mode: "regular",
      origin: {
        kind: "method-source",
        path: methodPath({ kind: "agent", within: "aidlc-developer-agent.md" }),
      },
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
      mode: "regular",
      origin: { kind: "rendered", concept: "stage-command", name: "code-generation" },
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
      mode: "regular",
      origin: { kind: "rendered", concept: "scope-command", name: "feature" },
    },
    {
      path: path(".claude/aidlc-common/stages/construction/code-generation.md"),
      content: text(["---", "slug: code-generation", "phase: construction", "---"]),
      mode: "regular",
      origin: {
        kind: "method-source",
        path: methodPath({ kind: "stage", within: "construction/code-generation.md" }),
      },
    },
    {
      path: path(".claude/knowledge/aidlc-developer-agent/code-generation-guide.md"),
      content: text(["# Code Generation Guide"]),
      mode: "regular",
      origin: {
        kind: "method-source",
        path: methodPath({
          kind: "knowledge",
          within: "aidlc-developer-agent/code-generation-guide.md",
        }),
      },
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
      mode: "regular",
      origin: { kind: "rendered", concept: "hook-registration", name: "settings" },
    },
    {
      path: path(".claude/CLAUDE.md"),
      content: text(["# AI-DLC", "", "Type `/aidlc` to start."]),
      mode: "regular",
      origin: { kind: "rendered", concept: "onboarding", name: "CLAUDE.md" },
    },
    {
      path: path(".gitignore"),
      content: text(["# >>> aidlc gitignore", "aidlc/**/.aidlc-*", "# <<< aidlc gitignore"]),
      mode: "regular",
      origin: { kind: "harness-authored", source: source("harness/claude/dot-gitignore") },
    },
  ],
  findings: [],
} as const satisfies Projection;
