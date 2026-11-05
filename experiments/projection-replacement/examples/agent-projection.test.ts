import { expect, test } from "bun:test";
import { agentSourceCases } from "../__tests__/agent-source-cases.ts";
import {
  claudeAgentContext,
  cursorAgentContext,
  malformedMetricsSource,
  agentOrigin,
} from "../__tests__/agent-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentStage } from "../src/adapters/agent-source.ts";
import { projectAuthoredAgent } from "./agent-projection.ts";

test.each([
  ...agentSourceCases,
])("composition: $baseline $kind Claude authored source to native agent and knowledge", (entry) => {
  const stage = successful(parseAgentStage({ text: entry.stageText, origin: entry.stageOrigin }));
  const projected = successful(
    projectAuthoredAgent({
      ...entry,
      stages: [stage],
      context: {
        ...claudeAgentContext,
        sharedKnowledge: entry.sharedKnowledge,
        models: entry.claudeModels,
      },
    }),
  );
  expect(projected.resources).toEqual(entry.resources.claude);
  expect(projected.origin).toEqual(entry.origin);
  expect(projected.participation).toEqual([
    { origin: entry.stageOrigin, stage: "test-pro-integration", mode: "inline", role: entry.role },
  ]);
});
test.each([
  ...agentSourceCases,
])("composition: $baseline $kind Cursor authored source to native agent and knowledge", (entry) => {
  const stage = successful(parseAgentStage({ text: entry.stageText, origin: entry.stageOrigin }));
  const projected = successful(
    projectAuthoredAgent({
      ...entry,
      stages: [stage],
      context: {
        ...cursorAgentContext,
        sharedKnowledge: entry.sharedKnowledge,
        memoryReference: entry.cursorMemory,
      },
    }),
  );
  expect(projected.resources).toEqual(entry.resources.cursor);
});
test("composition: malformed YAML fails as data at the authored boundary", () => {
  expect(
    projectAuthoredAgent({
      text: malformedMetricsSource,
      origin: agentOrigin,
      context: claudeAgentContext,
      knowledge: [],
      stages: [],
    }),
  ).toEqual({
    status: "invalid",
    findings: [
      {
        code: "invalid-input",
        subject: "frontmatter",
        detail: "expected valid YAML with unique mapping keys",
      },
    ],
  });
});
