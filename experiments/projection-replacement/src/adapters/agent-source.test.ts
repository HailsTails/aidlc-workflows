import { expect, mock, test } from "bun:test";
import {
  agentOrigin,
  metricsAgent,
  metricsSource,
  metricsSourceWithoutExamples,
  metricsYaml,
  metricsFrontmatter,
  integrationStage,
  integrationStageYaml,
  metricsBodyWithPolicyExamples,
  metricsSourceWithPolicyExamples,
  unsupportedAgentSyntaxCases,
} from "../../__tests__/agent-fixtures.ts";
import { parseAgentSource, parseAgentStage } from "./agent-source.ts";

test("missing examples remain absent from authored text and normalize to no declarations", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: sonnet", body: metricsAgent.body, decoded: { ...metricsYaml, examples: undefined } } });
  expect(parseAgentSource({ text: metricsSourceWithoutExamples, origin: agentOrigin, reader: { read } })).toEqual({ status: "ok", value: { ...metricsAgent, examples: [], frontmatter: "name: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: sonnet" } });
});
test("authored policy fields become explicit domain choices without widening tools", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsAgent.body, decoded: { ...metricsYaml, tools: "Read, Grep, Glob", maxTurns: 60, omitClaudeMd: true } } });
  expect(parseAgentSource({ text: metricsSource, origin: agentOrigin, reader: { read } })).toEqual({ status: "ok", value: { ...metricsAgent, policy: { tools: { kind: "allow", names: ["Read", "Grep", "Glob"] }, turnLimit: 60, ambientInstructions: "omit-claude-md" } } });
});

test("accepts a real model-only shape and retains authored metadata", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsAgent.body, decoded: metricsYaml } });
  const parsed = parseAgentSource({ text: metricsSource, origin: agentOrigin, reader: { read } });
  expect(parsed).toEqual({ status: "ok", value: metricsAgent });
  expect(read).toHaveBeenCalledWith({ text: metricsSource });
  expect(read).toHaveBeenCalledTimes(1);
});
test("policy examples in the body are literal content, not duplicate metadata", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsBodyWithPolicyExamples, decoded: metricsYaml } });
  expect(
    parseAgentSource({
      text: metricsSourceWithPolicyExamples,
      origin: agentOrigin,
      reader: { read },
    }),
  ).toEqual({ status: "ok", value: { ...metricsAgent, body: metricsBodyWithPolicyExamples } });
});
test.each([
  { label: "missing choice", expectedField: "model", authored: { ...metricsYaml, model: undefined } },
  { label: "ambiguous choice", expectedField: "model", authored: { ...metricsYaml, tier: "balanced" } },
  { label: "unknown permission", expectedField: "disallowedTools", authored: { ...metricsYaml, disallowedTools: "Bash" } },
  { label: "invalid tool representation", expectedField: "tools", authored: { ...metricsYaml, tools: ["Bash"] } },
  { label: "path example", expectedField: "examples", authored: { ...metricsYaml, examples: ["../methodology.md"] } },
])("refuses $label with useful boundary findings", ({ authored, expectedField }) => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsAgent.body, decoded: authored } });
  const parsed = parseAgentSource({ text: metricsSource, origin: agentOrigin, reader: { read } });
  expect(parsed).toMatchObject({
    status: "invalid",
    findings: [{ code: "invalid-input", subject: agentOrigin.path, detail: expect.stringContaining(expectedField) }],
  });
});
test.each(unsupportedAgentSyntaxCases)("refuses preservation bypass: $label", ({ text, header }) => {
  const read = mock().mockReturnValue({ status: "ok", value: { header, body: metricsAgent.body, decoded: metricsYaml } });
  const parsed = parseAgentSource({ text, origin: agentOrigin, reader: { read } });
  expect(parsed).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-input",
        subject: agentOrigin.path,
        detail:
          "unsupported agent metadata spelling; use unique plain keys and single-line tier/model/disallowedTools fields",
      },
    ],
  });
});
test("refuses a source owner mismatch", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsAgent.body, decoded: metricsYaml } });
  const parsed = parseAgentSource({
    text: metricsSource,
    origin: {
      ...agentOrigin,
      source: { kind: "plugin", id: "other" },
      path: "plugins/other/agents/test-pro-metrics-agent.md",
    },
    reader: { read },
  });
  expect(parsed).toEqual({
    status: "invalid",
    findings: [
      {
        code: "foreign-content",
        subject: "plugins/other/agents/test-pro-metrics-agent.md",
        detail: "frontmatter plugin must agree with its source owner",
      },
    ],
  });
});
test.each([
  "plugins/test-pro/agents/other-agent.md",
  "plugins/test-pro/agents/../agents/test-pro-metrics-agent.md",
  "plugins/test-pro/agents//test-pro-metrics-agent.md",
])("refuses a noncanonical agent identity: %s", (path) => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: metricsFrontmatter, body: metricsAgent.body, decoded: metricsYaml } });
  expect(
    parseAgentSource({ text: metricsSource, origin: { ...agentOrigin, path }, reader: { read } }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-path",
        subject: path,
        detail: "agent filename and source directory must agree with its authored name and owner",
      },
    ],
  });
});
test("extracts participation without compiling the stage graph", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: "slug: test-pro-integration", body: "# Stage", decoded: integrationStageYaml } });
  const parsed = parseAgentStage({
    text: "---\nslug: test-pro-integration\n---\n# Stage",
    origin: integrationStage.origin,
    reader: { read },
  });
  expect(parsed).toEqual({ status: "ok", value: integrationStage });
  expect(read).toHaveBeenCalledWith({ text: "---\nslug: test-pro-integration\n---\n# Stage" });
});
test("authored pipeline participation preserves the source topology", () => {
  const read = mock().mockReturnValue({ status: "ok", value: { header: "slug: test-pro-integration", body: "# Stage", decoded: { ...integrationStageYaml, mode: "pipeline" } } });
  expect(parseAgentStage({ text: "source", origin: integrationStage.origin, reader: { read } })).toEqual({ status: "ok", value: { ...integrationStage, mode: "pipeline" } });
});
