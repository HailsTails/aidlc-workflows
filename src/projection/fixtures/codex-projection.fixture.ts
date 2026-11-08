import { distribution, hash, path } from "../../kernel/fixtures/values.fixture.ts";
import type { HarnessProfile } from "../domain/harness-profile.ts";
import type { Projection } from "../domain/projection.ts";
import { text } from "./values.fixture.ts";

const codexProfile: HarnessProfile = {
  distribution: distribution("codex"),
  productName: "Codex CLI",
  choiceName: null,
  choiceNote: null,
  harnessDirectory: path(".codex"),
  orchestratorSkill: path(".agents/skills/aidlc/SKILL.md"),
  firstRun: {
    configNextStep:
      "run `codex` (when it asks about hooks, choose Trust all and continue), then " +
      "`$aidlc --doctor`",
    firstRunSteps: null,
  },
  cliFirst: null,
  editorTerminalApp: null,
  hostShell: {
    marks: [
      { variable: "CODEX_SESSION_ID", value: null },
      { variable: "CODEX_THREAD_ID", value: null },
    ],
  },
  newChatStep: { text: "open a new chat, then type <entry>", inHost: null },
  hookActivation: null,
  agentFinishRecorded: null,
  statusLine: null,
  directiveMaxBytes: null,
  questionOptions: null,
};

export const codexProjectionFixture: Projection = {
  harness: codexProfile.distribution,
  profile: codexProfile,
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
      origin: { kind: "harness-authored", source: path("harness/codex/rules-aidlc.md") },
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
    {
      path: path(".codex/tools/data/harness.json"),
      content: text(['{ "schemaVersion": 2, "distribution": "codex" }']),
      executable: false,
      origin: { kind: "rendered", concept: "harness-profile", name: "codex" },
      availability: "always",
    },
  ],
  rootIntegrations: [
    {
      path: path(".gitignore"),
      policy: "managed-block",
      marker: "gitignore",
      sharing: "union",
      optional: false,
      legacy: { wholeFileHashes: [], jsonEntryHashes: {} },
    },
    {
      path: path("AGENTS.md"),
      policy: "managed-block",
      marker: "agents",
      sharing: "identical",
      optional: false,
      legacy: {
        wholeFileHashes: [
          hash("sha256:30a9f5f43d87cd29b63e75333b8ef6695f8f4e11909fd6af64e2b6cf0b8cb292"),
        ],
        jsonEntryHashes: {},
      },
    },
  ],
  managedDirectories: [
    { path: path(".codex"), ownership: "shipped-files-only" },
    { path: path(".codex/aidlc-rules"), ownership: "whole-directory" },
    { path: path(".codex/tools"), ownership: "whole-directory" },
    { path: path(".agents/skills"), ownership: "shipped-files-only" },
  ],
  findings: [],
};
