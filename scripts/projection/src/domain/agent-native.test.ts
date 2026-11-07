import { expect, test } from "bun:test";
import { nativeMetricsInput, rendererModelCases } from "../../../../tests/unit/projection/support/__tests__/agent-fixtures.ts";
import { createMarkdownAgentEmitter, projectAgentFrontmatter } from "./agent-native.ts";

test.each(rendererModelCases)("native frontmatter: $label", ({
  agent,
  nativeModel,
  expectedFields,
}) => {
  expect(
    projectAgentFrontmatter({
      frontmatter: agent.frontmatter,
      nativeModel,
      effortKey: "effort",
      removeKeys: [],
      additions: [],
    }),
  ).toEqual(expectedFields);
});
test("default native emitter preserves authored fields and prepared content", () => {
  expect(createMarkdownAgentEmitter().emit(nativeMetricsInput)).toEqual({
    status: "ok",
    value: [
      {
        kind: "file",
        path: ".claude/agents/test-pro-metrics-agent.md",
        body: "---\nname: test-pro-metrics-agent\ndisplay_name: Metrics\nplugin: test-pro\nexamples:\n  - methodology.md\ndescription: Metrics specialist\ndisallowedTools: Task\nmodel: sonnet\n---\nPrepared preflight\n\n\nProjected metrics body.\n",
      },
    ],
  });
});
test("new native formats cannot silently use the default Markdown emitter", () => {
  expect(
    createMarkdownAgentEmitter().emit({
      ...nativeMetricsInput,
      binding: { harness: "codex", directory: ".codex" },
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "capability-gap",
        subject: "test-pro-metrics-agent",
        detail: "codex requires its own native agent emitter",
      },
    ],
  });
});
