import { distribution, hash, path } from "../../kernel/fixtures/values.fixture.ts";
import type { HarnessProfile } from "../domain/harness-profile.ts";
import type { Projection } from "../domain/projection.ts";
import { text } from "./values.fixture.ts";

const claudeProfile: HarnessProfile = {
  distribution: distribution("claude"),
  productName: "Claude Code",
  choiceName: null,
  choiceNote: null,
  harnessDirectory: path(".claude"),
  orchestratorSkill: path(".claude/skills/aidlc/SKILL.md"),
  firstRun: {
    configNextStep:
      "open Claude Code in this project (if it is already open in this folder, exit it and " +
      "start it again) and run `/aidlc --doctor`",
    firstRunSteps: null,
  },
  cliFirst: null,
  editorTerminalApp: null,
  hostShell: {
    marks: [
      { variable: "CLAUDECODE", value: null },
      { variable: "CLAUDE_CODE_SESSION_ID", value: null },
    ],
  },
  newChatStep: { text: "type /clear, then <entry>", inHost: null },
  hookActivation: {
    recovery:
      'Set "disableAllHooks": false in this project\'s .claude/settings.local.json; it works ' +
      "in the same chat.",
    missedReply: null,
    missedReplyInHost: null,
    missesReplies: false,
    notRunYet:
      "This is expected before your first Claude Code chat in this folder. Then run doctor again.",
    notRunYetCliFirst: null,
    notRunInWorkflow: null,
    agentStep:
      "Claude Code is not running AI-DLC's hooks in this project. Then run <next> and act on " +
      "what it returns.",
    agentStepInHost: null,
    agentStepEdits: path(".claude/settings.local.json"),
    registration: {
      file: path(".claude/settings.json"),
      missing:
        ".claude/settings.json is missing from this project, so Claude Code runs none of " +
        "AI-DLC's hooks here. In a terminal in this folder, <repair>.",
      invalid:
        "Claude Code cannot read this project's .claude/settings.json because it is not " +
        "valid JSON.",
      unwired:
        ".claude/settings.json in this project does not register AI-DLC's hooks. In a " +
        "terminal in this folder, <repair>.",
    },
    startedInsideProject:
      "Claude Code runs this project's hooks only when it is started in the project folder. " +
      "Exit Claude Code, start it again in <folder>, then type <entry>.",
  },
  agentFinishRecorded: { marks: [{ variable: "CLAUDE_CODE_SESSION_ID", value: null }] },
  statusLine: {
    kind: "command",
    command: 'bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine statusline',
  },
  directiveMaxBytes: null,
  questionOptions: 4,
};

export const claudeProjectionFixture: Projection = {
  harness: claudeProfile.distribution,
  profile: claudeProfile,
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
        kind: "neutral",
        source: path("aidlc-common/stages/construction/code-generation.md"),
      },
      availability: "always",
    },
    {
      path: path(".claude/knowledge/aidlc-developer-agent/code-generation-guide.md"),
      content: text(["# Code Generation Guide"]),
      executable: false,
      origin: {
        kind: "neutral",
        source: path("knowledge/aidlc-developer-agent/code-generation-guide.md"),
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
      path: path(".claude/tools/data/harness.json"),
      content: text(['{ "schemaVersion": 2, "distribution": "claude" }']),
      executable: false,
      origin: { kind: "rendered", concept: "harness-profile", name: "claude" },
      availability: "always",
    },
    {
      path: path(".gitignore"),
      content: text(["# >>> aidlc gitignore", "aidlc/**/.aidlc-*", "# <<< aidlc gitignore"]),
      executable: false,
      origin: { kind: "harness-authored", source: path("harness/claude/dot-gitignore") },
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
      legacy: {
        wholeFileHashes: [
          hash("sha256:3da36b2d01551aeae2e366caa08be8cce0dbc9110e252445dcaa4e758e24a0b6"),
          hash("sha256:4f1cd2e930bd37d2f5d715a06ea3fa1e2d39479fc662f0f0562116376132114b"),
        ],
        jsonEntryHashes: {},
      },
    },
    {
      path: path(".mcp.json"),
      policy: "json-map",
      key: "mcpServers",
      optional: true,
      legacy: {
        wholeFileHashes: [],
        jsonEntryHashes: {
          context7: [
            hash("sha256:8a440d21705f35c8f5649f118d17f786e08d589fb2dd888f5de5aa503233afbf"),
          ],
        },
      },
    },
  ],
  managedDirectories: [
    path(".claude/agents"),
    path(".claude/aidlc-common"),
    path(".claude/knowledge"),
    path(".claude/skills"),
    path(".claude/tools"),
  ],
  findings: [],
};
