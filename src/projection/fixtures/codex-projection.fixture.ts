import { distribution, path, source } from "../../kernel/fixtures/values.fixture.ts";
import type { Projection } from "../domain/projection.ts";
import { root, text } from "./values.fixture.ts";

export const codexProjectionFixture: Projection = {
  harness: distribution("codex"),
  methodSourceRoot: root(".codex"),
  files: [
    {
      path: path(".codex/agents/aidlc-developer-agent.toml"),
      content: text([
        'name = "aidlc-developer-agent"',
        'description = "Senior developer responsible for code generation."',
        'developer_instructions = """',
        "# Developer Agent",
        '"""',
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "agent", name: "aidlc-developer-agent" },
      availability: "always",
    },
    {
      path: path(".agents/skills/aidlc-code-generation/SKILL.md"),
      content: text([
        "---",
        "name: aidlc-code-generation",
        "description: Run AI-DLC stage 3.5 Code Generation",
        "---",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "stage-command", name: "code-generation" },
      availability: "always",
    },
    {
      path: path(".agents/skills/aidlc/SKILL.md"),
      content: text(["---", "name: aidlc", "description: Drive AI-DLC", "---"]),
      executable: false,
      origin: { kind: "rendered", concept: "orchestrator-skill", name: "aidlc" },
      availability: "always",
    },
    {
      path: path(".codex/aidlc-rules/aidlc.md"),
      content: text(["# AI-DLC rules"]),
      executable: false,
      origin: { kind: "harness-authored", source: source("harness/codex/rules-aidlc.md") },
      availability: "always",
    },
    {
      path: path(".codex/hooks.json"),
      content: text([
        "{",
        '  "UserPromptSubmit": [{ "command": "aidlc engine hook record-human-turn" }]',
        "}",
      ]),
      executable: false,
      origin: { kind: "rendered", concept: "hook-registration", name: "hooks.json" },
      availability: "always",
    },
    {
      path: path("AGENTS.md"),
      content: text(["<!-- aidlc:agents -->", "# AI-DLC", "<!-- /aidlc:agents -->"]),
      executable: false,
      origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" },
      availability: "always",
    },
    {
      path: path(".codex/onboarding.md"),
      content: text(["# Codex setup", "", "Type `$aidlc` to start."]),
      executable: false,
      origin: { kind: "rendered", concept: "onboarding", name: "onboarding.md" },
      availability: "always",
    },
  ],
  findings: [],
};
