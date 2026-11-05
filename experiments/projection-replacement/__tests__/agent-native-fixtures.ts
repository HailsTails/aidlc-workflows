import type {
  AuthoredKiroAgentProfile,
  PreparedKiroAgentProfile,
} from "../src/adapters/kiro-agent.ts";
import type { KasWorkerPolicy } from "../src/adapters/kas-agent.ts";
import type { AgentEmissionInput } from "../src/domain/agent-native.ts";
import {
  agentOrigin,
  nativeMetricsInput,
  preparedMetrics,
  claudeAgentContext,
  metricsExpectedPreflight,
} from "./agent-fixtures.ts";

export const codexMetricsInput: AgentEmissionInput = {
  ...nativeMetricsInput,
  binding: { harness: "codex", directory: ".codex" },
  nativeModel: { model: null, effort: null },
};
export const copilotMetricsInput: AgentEmissionInput = {
  ...nativeMetricsInput,
  binding: { harness: "copilot", directory: ".aidlc" },
  nativeModel: { model: null, effort: null },
};
export const opencodeMetricsInput: AgentEmissionInput = {
  ...nativeMetricsInput,
  binding: { harness: "opencode", directory: ".aidlc" },
  nativeModel: { model: null, effort: "medium" },
};
export const kasMetricsInput: AgentEmissionInput = {
  ...nativeMetricsInput,
  binding: { harness: "kiro-ide", directory: ".kiro" },
  nativeModel: { model: null, effort: null },
};
export const kiroMetricsInput: AgentEmissionInput = {
  ...nativeMetricsInput,
  binding: { harness: "kiro", directory: ".kiro" },
  nativeModel: { model: null, effort: null },
};
export const nativePolicyOrigin = {
  source: { kind: "core", id: "framework" },
  pin: agentOrigin.pin,
  path: "harness/kiro/agents/test-pro-metrics-agent.json",
} as const;
export const authoredKiroProfile: AuthoredKiroAgentProfile = {
  state: "authored",
  origin: nativePolicyOrigin,
  name: "test-pro-metrics-agent",
  description: "Native metrics",
  prompt: "file://test-pro-metrics-agent.md",
  tools: ["fs_read", "execute_bash"],
  allowedTools: ["fs_read"],
  shellCommands: ["bun (run )?[\"']?\\.kiro/tools/[A-Za-z0-9._-]+\\.ts[\"']?( .*)?"],
  shellDenials: ["deny mutation"],
  writePaths: ["aidlc/spaces/**"],
  resources: [
    "file://.kiro/agents/test-pro-metrics-agent.md",
    "file://.kiro/knowledge/aidlc-shared/*.md",
  ],
  hooks: {
    preToolUse: [{ matcher: "execute_bash", command: "{{INVOKE}} engine guard", timeoutMs: 100 }],
  },
};
export const preparedKiroProfile: PreparedKiroAgentProfile = {
  ...authoredKiroProfile,
  state: "prepared",
  shellCommands: ["prepared command"],
  resources: [
    "file://.kiro/agents/test-pro-metrics-agent.md",
    "file://.kiro/knowledge/aidlc-shared/method.md",
  ],
  hooks: {
    preToolUse: [
      {
        matcher: "execute_bash",
        command: "echo $& engine guard; exit $LASTEXITCODE",
        timeoutMs: 100,
      },
    ],
  },
};
export const rawKiroProfile =
  '{"name":"test-pro-metrics-agent","description":"Native metrics","prompt":"file://test-pro-metrics-agent.md","includeMcpJson":true,"tools":["fs_read","execute_bash"],"allowedTools":["fs_read"],"toolsSettings":{"execute_bash":{"allowedCommands":["bun (run )?[\\"\u0027]?\\\\.kiro/tools/[A-Za-z0-9._-]+\\\\.ts[\\"\u0027]?( .*)?"],"deniedCommands":["deny mutation"]},"fs_write":{"allowedPaths":["aidlc/spaces/**"]}},"resources":["file://.kiro/agents/test-pro-metrics-agent.md","file://.kiro/knowledge/aidlc-shared/*.md"],"hooks":{"preToolUse":[{"matcher":"execute_bash","command":"{{INVOKE}} engine guard","timeout_ms":100}]}}';
export const kasPolicy: KasWorkerPolicy = {
  contract: { tools: ["read", "write", "shell"], includeMcpJson: true, permissions: { rules: [] } },
  origin: { ...nativePolicyOrigin, path: "harness/kiro-ide/manifest.ts" },
  name: "test-pro-metrics-agent",
  lines: [
    'tools: ["read", "write", "shell"]',
    "includeMcpJson: true",
    "permissions:",
    "  rules: []",
  ],
};
export const preparedKiroJson = `{
  "name": "test-pro-metrics-agent",
  "description": "Native metrics",
  "prompt": "file://test-pro-metrics-agent.md",
  "includeMcpJson": true,
  "tools": [
    "fs_read",
    "execute_bash"
  ],
  "allowedTools": [
    "fs_read"
  ],
  "toolsSettings": {
    "execute_bash": {
      "allowedCommands": [
        "prepared command"
      ],
      "deniedCommands": [
        "deny mutation"
      ]
    },
    "fs_write": {
      "allowedPaths": [
        "aidlc/spaces/**"
      ]
    }
  },
  "resources": [
    "file://.kiro/agents/test-pro-metrics-agent.md",
    "file://.kiro/knowledge/aidlc-shared/method.md"
  ],
  "hooks": {
    "preToolUse": [
      {
        "matcher": "execute_bash",
        "command": "echo $& engine guard; exit $LASTEXITCODE",
        "timeout_ms": 100
      }
    ]
  }
}
`;
const kiroDelegationSelectors = [
  { label: "explicit delegation tool", selector: "use_subagent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "use_subagent"' },
  { label: "wildcard delegation bypass", selector: "*", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "*"' },
  { label: "pinned conductor alias", selector: "subagent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "subagent"' },
  { label: "legacy agent alias", selector: "agent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "agent"' },
  { label: "direct invocation tool", selector: "invoke_sub_agent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "invoke_sub_agent"' },
  { label: "all builtins", selector: "@builtin", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin"' },
  { label: "namespaced builtin wildcard", selector: "@builtin/*", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin/*"' },
  { label: "namespaced conductor alias", selector: "@builtin/subagent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin/subagent"' },
  { label: "namespaced legacy delegation", selector: "@builtin/use_subagent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin/use_subagent"' },
  { label: "namespaced direct invocation", selector: "@builtin/invoke_sub_agent", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin/invoke_sub_agent"' },
  { label: "per-agent dispatch", selector: "subagent/metrics", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "subagent/metrics"' },
  { label: "all per-agent dispatch", selector: "subagent/*", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "subagent/*"' },
  { label: "namespaced per-agent dispatch", selector: "@builtin/subagent/metrics", expectedDetail: 'delegated Kiro profiles must omit native delegation selector "@builtin/subagent/metrics"' },
  { label: "whitespace dispatch alias", selector: " subagent ", expectedDetail: 'delegated Kiro profiles must omit native delegation selector " subagent "' },
];
export const delegatedKiroProfileCases = kiroDelegationSelectors.map((entry) => ({ ...entry, text: rawKiroProfile.replace('"fs_read","execute_bash"', JSON.stringify(["fs_read", entry.selector]).slice(1, -1)) }));
export const ordinaryKiroSelectorCases = ["@my-agent", "@subagent", "@provider/subagent", "@provider/invoke_sub_agent", "@builtin/read_file", "thinking", "execute_bash"].map((selector) => ({ selector, text: rawKiroProfile.replace('"fs_read","execute_bash"', JSON.stringify(["fs_read", selector]).slice(1, -1)) }));
export const mcpKiroProfileText = rawKiroProfile.replace(
  '"fs_read","execute_bash"',
  '"fs_read","@my-agent"',
);

export const rendererExpectedEmitterInput = {
  policy: preparedMetrics.agent.policy,
  origin: preparedMetrics.agent.origin,
  binding: claudeAgentContext,
  name: "test-pro-metrics-agent",
  description: "projected description",
  frontmatter: "projected frontmatter",
  body: "projected body",
  preflight: metricsExpectedPreflight,
  nativeModel: { model: "sonnet", effort: null },
} as const;

export const rendererExpectedTextCalls = [
  [
    {
      text: "\n# Metrics\nRead {{HARNESS_DIR}}/rules/.\n",
      contract: {
        harness: "claude",
        harnessDir: ".claude",
        rulesSubdir: "rules",
        invocation: "bun .claude/tools/aidlc.ts",
        memoryRoot: "aidlc/active-memory",
      },
    },
  ],
  [
    {
      text: "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: sonnet",
      contract: {
        harness: "claude",
        harnessDir: ".claude",
        rulesSubdir: "rules",
        invocation: "bun .claude/tools/aidlc.ts",
        memoryRoot: "aidlc/active-memory",
      },
    },
  ],
  [
    {
      text: "Metrics specialist",
      contract: {
        harness: "claude",
        harnessDir: ".claude",
        rulesSubdir: "rules",
        invocation: "bun .claude/tools/aidlc.ts",
        memoryRoot: "aidlc/active-memory",
      },
    },
  ],
  [
    {
      text: "# Methodology\nCompare release evidence.\n",
      contract: {
        harness: "claude",
        harnessDir: ".claude",
        rulesSubdir: "rules",
        invocation: "bun .claude/tools/aidlc.ts",
        memoryRoot: "aidlc/active-memory",
      },
    },
  ],
];

export const rendererExpectedProjection = {
  status: "ok",
  value: {
    origin: preparedMetrics.agent.origin,
    harness: "claude",
    resources: [
      { kind: "file", path: ".claude/agents/test-pro-metrics-agent.md", body: "native persona" },
      {
        kind: "file",
        path: ".claude/knowledge/test-pro-metrics-agent/methodology.md",
        body: "projected methodology",
      },
    ],
    participation: preparedMetrics.participation,
  },
} as const;

export const rendererExpectedResidueCalls = [
  [{ text: "native persona", subject: ".claude/agents/test-pro-metrics-agent.md" }],
  [
    {
      text: "projected methodology",
      subject: ".claude/knowledge/test-pro-metrics-agent/methodology.md",
    },
  ],
];

const rawKiroAliasCases = [
  {
    label: "shell alias",
    text: rawKiroProfile.replace(
      '"toolsSettings":{',
      '"toolsSettings":{"shell":{"allowedCommands":["anything"]},',
    ),
    path: ["toolsSettings"],
    key: "shell",
  },
  {
    label: "write alias",
    text: rawKiroProfile.replace(
      '"toolsSettings":{',
      '"toolsSettings":{"writing":{"allowedPaths":["**"]},',
    ),
    path: ["toolsSettings"],
    key: "writing",
  },
  {
    label: "hook alias",
    text: rawKiroProfile.replace('"timeout_ms":100', '"timeout_ms":100,"timeoutMs":1'),
    path: ["hooks", "preToolUse", 0],
    key: "timeoutMs",
  },
  {
    label: "unknown native field",
    text: rawKiroProfile.replace('"toolsSettings":{', '"toolsSettings":{"unknown":{},'),
    path: ["toolsSettings"],
    key: "unknown",
  },
];

export const kiroAliasCases = rawKiroAliasCases.map((entry) => ({
  ...entry,
  expectedDetail: JSON.stringify(
    [
      {
        code: "unrecognized_keys",
        keys: [entry.key],
        path: entry.path,
        message: `Unrecognized key: "${entry.key}"`,
      },
    ],
    null,
    2,
  ),
}));

export const selectedModelKiroJson = preparedKiroJson.replace(/\n}\n$/, ",\n  \"model\": \"claude-sonnet-4.6\"\n}\n");
