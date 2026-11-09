import type { AuthoredPlacement, HostData } from "../domain/host-surface.ts";

export const claudeHostDataFixture: HostData = {
  productName: "Claude Code",
  configNextStep: "open Claude Code in this project and run `/aidlc --doctor`",
  rulesFolder: null,
  runnerFrontmatterAdditions: ["disable-model-invocation: true"],
  hookActivation: {
    recovery: "Run {{INVOKE}} doctor, then start Claude Code again in <folder>.",
    missesReplies: true,
    registration: {
      file: ".claude/settings.json",
      missing: "The hook registration is missing.",
      invalid: "The hook registration is not valid JSON.",
      unwired: "A hook is not wired.",
    },
  },
  newChatStep: { text: "type /clear, then <entry>" },
  statusLine: { type: "command", command: 'bun "$CLAUDE_PROJECT_DIR/.claude/tools/aidlc.ts" engine statusline' },
  agentFinishRecorded: { env: ["CLAUDE_CODE_SESSION_ID"] },
  hostShell: { env: ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID"] },
};

export const kiroHostDataFixture: HostData = {
  productName: "Kiro CLI",
  configNextStep: "start kiro-cli in this project and run /aidlc",
  rulesFolder: "steering",
  hookActivation: {
    recovery: "Start the agent again with {{TOOL_PREFIX}}aidlc-doctor.ts.",
    agentStepInHost: { env: ["KIRO_IDE"], text: "Reload the window." },
  },
  kiroLayout: "agent-v1",
  hostShell: { env: ["KIRO_SESSION_ID"] },
  pluginAgentFrontmatter: {
    copy: ["tools: [\"*\"]", "  - \"bun .kiro/tools/aidlc-*\""],
    native: ["tools: [\"*\"]", "  - \"aidlc engine *\""],
  },
};

export const AUTHORED_PLACEMENTS_FIXTURE: readonly AuthoredPlacement[] = [
  { source: "settings.local.json.example", destination: ".claude/settings.local.json.example" },
  { source: ".mcp.json", destination: ".mcp.json" },
  { source: "dot-gitignore", destination: ".gitignore" },
];
