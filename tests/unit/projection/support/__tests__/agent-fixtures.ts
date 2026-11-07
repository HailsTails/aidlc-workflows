import type {
  AgentContext,
  AgentKnowledge,
  AgentOrigin,
  AuthoredAgentStage,
  AuthoredAgent,
  PreparedAgent,
} from "../../../../../scripts/projection/src/domain/agent-definition.ts";
import type { AgentEmissionInput } from "../../../../../scripts/projection/src/domain/agent-native.ts";

export const agentOrigin: AgentOrigin = {
  source: { kind: "plugin", id: "test-pro" },
  pin: "d062c81e",
  path: "plugins/test-pro/agents/test-pro-metrics-agent.md",
};
export const metricsFrontmatter =
  "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: sonnet";
export const metricsYaml = Object.fromEntries([
  ["name", "test-pro-metrics-agent"],
  ["display_name", "Metrics"],
  ["plugin", "test-pro"],
  ["examples", ["methodology.md"]],
  ["description", "Metrics specialist"],
  ["disallowedTools", "Task"],
  ["model", "sonnet"],
]);
export const integrationStageYaml = Object.fromEntries([
  ["slug", "test-pro-integration"],
  ["mode", "inline"],
  ["lead_agent", "aidlc-quality-agent"],
  ["support_agents", ["test-pro-metrics-agent"]],
  ["requires_stage", ["build-and-test"]],
]);
export const metricsAgent: AuthoredAgent = {
  origin: agentOrigin,
  name: "test-pro-metrics-agent",
  description: "Metrics specialist",
  examples: ["methodology.md"],
  model: { kind: "explicit", model: "sonnet" },
  delegation: "leaf",
  policy: { tools: { kind: "inherit" }, turnLimit: null, ambientInstructions: "inherit" },
  frontmatter: metricsFrontmatter,
  body: "\n# Metrics\nRead {{HARNESS_DIR}}/rules/.\n",
};
export const claudeAgentContext: AgentContext = {
  harness: "claude",
  directory: ".claude",
  invocation: "bun .claude/tools/aidlc.ts",
  tierCap: "judgment",
  sharedKnowledge: "all",
  rulesSubdir: "rules",
  knowledgeRead: "ordinary",
  models: {
    tiers: {
      judgment: { model: "inherit", effort: null },
      balanced: { model: "sonnet", effort: "medium" },
      templated: { model: "inherit", effort: null },
    },
    explicit: "preserve",
  },
  memoryReference: null,
};
export const cursorAgentContext: AgentContext = {
  ...claudeAgentContext,
  harness: "cursor",
  directory: ".cursor",
  invocation: "bun .cursor/tools/aidlc.ts",
  models: {
    tiers: {
      judgment: { model: null, effort: null },
      balanced: { model: null, effort: null },
      templated: { model: null, effort: null },
    },
    explicit: "inherit",
  },
  memoryReference: "aidlc/active-memory",
};
export const methodologyKnowledge: AgentKnowledge = {
  origin: {
    ...agentOrigin,
    path: "plugins/test-pro/knowledge/test-pro-metrics-agent/methodology.md",
  },
  body: "# Methodology\nCompare release evidence.\n",
};
export const integrationStage: AuthoredAgentStage = {
  reviewer: null,
  origin: { ...agentOrigin, path: "plugins/test-pro/stages/construction/test-pro-integration.md" },
  slug: "test-pro-integration",
  mode: "inline",
  lead: "aidlc-quality-agent",
  supports: ["test-pro-metrics-agent"],
};
export const preparedMetrics: PreparedAgent = {
  personaBody: metricsAgent.body,
  agent: metricsAgent,
  context: claudeAgentContext,
  nativeModel: { model: "sonnet", effort: null },
  knowledge: [methodologyKnowledge],
  participation: [
    {
      origin: integrationStage.origin,
      stage: "test-pro-integration",
      mode: "inline",
      role: "support",
    },
  ],
};
export const metricsSource = `---\n${metricsFrontmatter}\n---\n${metricsAgent.body}`;
export const malformedMetricsSource =
  "---\nname: test-pro-metrics-agent\ndescription: [\n---\n# Metrics";
export const metricsBodyWithPolicyExamples =
  "\n# Metrics\nmodel: first-example\nmodel: second-example\n";
export const metricsSourceWithPolicyExamples = `---\n${metricsFrontmatter}\n---\n${metricsBodyWithPolicyExamples}`;
export const unsupportedAgentSyntaxCases = [
  {
    label: "duplicate model key",
    header: metricsFrontmatter.replace("model: sonnet", "model: sonnet\nmodel: sonnet"),
    text: metricsSource.replace("model: sonnet", "model: sonnet\nmodel: sonnet"),
  },
  { label: "quoted policy key", header: metricsFrontmatter.replace("model: sonnet", '"model": sonnet'), text: metricsSource.replace("model: sonnet", '"model": sonnet') },
  { label: "folded policy", header: metricsFrontmatter.replace("model: sonnet", "model: >\n  sonnet"), text: metricsSource.replace("model: sonnet", "model: >\n  sonnet") },
  {
    label: "quoted permissions",
    header: metricsFrontmatter.replace("disallowedTools: Task", '"disallowedTools": Task'),
    text: metricsSource.replace("disallowedTools: Task", '"disallowedTools": Task'),
  },
];
export const tierMetricsAgent: AuthoredAgent = {
  ...metricsAgent,
  model: { kind: "tier", tier: "judgment" },
  frontmatter: metricsFrontmatter.replace("model: sonnet", "tier: judgment"),
};
export const rendererModelCases = [
  {
    label: "replace tier with native model and effort",
    agent: tierMetricsAgent,
    nativeModel: { model: "opus", effort: "high" },
    expectedFields:
      "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: opus\neffort: high",
  },
  {
    label: "omit unsupported native model dials",
    agent: metricsAgent,
    nativeModel: { model: null, effort: null },
    expectedFields:
      "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: Metrics specialist\ndisallowedTools: Task",
  },
];
export const metricsExpectedPreflight =
  "<!-- aidlc-delegated-knowledge-preflight -->\n**Delegated knowledge preflight (mandatory):** Before substantive work, ensure every readable Markdown file under these directories is loaded, in order: `.claude/knowledge/aidlc-shared/`, `.claude/knowledge/test-pro-metrics-agent/`, `aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then `aidlc/spaces/<active-space>/knowledge/test-pro-metrics-agent/`. A native resource preload satisfies this requirement; otherwise read the files now. The dispatch brief supplies rules and artifact paths separately.";
export const nativeMetricsInput: AgentEmissionInput = {
  policy: metricsAgent.policy,
  origin: agentOrigin,
  binding: { harness: "claude", directory: ".claude" },
  name: "test-pro-metrics-agent",
  description: "Metrics specialist",
  frontmatter: metricsFrontmatter,
  body: "\nProjected metrics body.\n",
  preflight: "Prepared preflight",
  nativeModel: { model: "sonnet", effort: null },
};

export const indentedMetricsSource =
  "---\n" +
  metricsFrontmatter
    .split("\n")
    .map((line) => " " + line)
    .join("\n") +
  "\n---\n" +
  metricsAgent.body;
export const duplicateIndentedMetricsSource =
  "---\n" +
  metricsFrontmatter
    .split("\n")
    .map((line) => " " + line)
    .join("\n") +
  "\n model: other\n---\n" +
  metricsAgent.body;

export const metricsSourceWithoutExamples = metricsSource.replace("examples:\n  - methodology.md\n", "");
