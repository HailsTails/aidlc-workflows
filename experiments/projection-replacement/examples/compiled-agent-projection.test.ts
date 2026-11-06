import { expect, test } from "bun:test";
import { compiledStageSourceCases, reviewerCompiledCase, rinCompiledCase } from "../__tests__/compiled-stage-source-cases.ts";
import { reviewerPolicyCase, reviewerOpenCodeContext, reviewerKnowledge, customerPolicyCase } from "../__tests__/agent-policy-cases.ts";
import { metricsAgent, claudeAgentContext } from "../__tests__/agent-fixtures.ts";
import { compiledCatalogue } from "../__tests__/compiled-stage-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { parseCompiledAgentStages } from "../src/adapters/compiled-agent-stages.ts";
import { parseAgentSource } from "../src/adapters/agent-source.ts";
import { projectAgentFromCompiledStages } from "./compiled-agent-projection.ts";

test.each(compiledStageSourceCases)("composition: $name compiled roster matches the native authored-stage frontend", ({ input, expected }) => {
  expect(parseCompiledAgentStages(input)).toEqual({ status: "ok", value: expected });
});
test("composition: compiled reviewer linkage preserves real native OpenCode persona and absorbed knowledge", () => {
  const catalogue = successful(parseCompiledAgentStages(reviewerCompiledCase.input));
  const agent = successful(parseAgentSource(reviewerPolicyCase));
  const projected = successful(projectAgentFromCompiledStages({ agent, context: reviewerOpenCodeContext, knowledge: reviewerKnowledge, catalogue }));
  expect(projected.resources[0]?.body).toEqual(reviewerPolicyCase.expected);
  expect(projected.participation).toContainEqual({ origin: { kind: "compiled", artifact: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: ".aidlc/tools/data/stage-graph.json" }, definition: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" } }, stage: "code-generation", mode: "subagent", role: "reviewer" });
});
test("composition: a stale actor source refuses before emitting native files", () => {
  expect(projectAgentFromCompiledStages({ agent: metricsAgent, context: claudeAgentContext, knowledge: [], catalogue: compiledCatalogue })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "agent source pin differs from its source basis in the compiled stage catalogue" }] });
});
test("composition: a compiled catalogue cannot relax an unsupported authored tool restriction", () => {
  const catalogue = successful(parseCompiledAgentStages(rinCompiledCase.input));
  const agent = successful(parseAgentSource(customerPolicyCase));
  expect(projectAgentFromCompiledStages({ agent, context: reviewerOpenCodeContext, knowledge: [], catalogue })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "rin-customer-reviewer-agent", detail: "opencode has no verified native projection for authored tools allowlist; prepare an explicit compatible policy before projecting this agent" }] });
});
