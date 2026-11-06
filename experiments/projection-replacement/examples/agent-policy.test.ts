import { expect, test } from "bun:test";
import { agentPolicyCases, reviewerPolicyCase, customerPolicyCase, omittedPolicyCases, reviewerStage, reviewerKnowledge, reviewerOpenCodeContext } from "../__tests__/agent-policy-cases.ts";
import { claudeAgentContext } from "../__tests__/agent-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { parseAgentSource, parseAgentStage } from "../src/adapters/agent-source.ts";
import { projectAuthoredAgent } from "./agent-projection.ts";

test.each(agentPolicyCases)("composition: real authored policies normalize without invented examples: $origin.path", (entry) => {
  const agent = successful(parseAgentSource(entry));
  expect(agent.policy).toEqual(entry.policy);
  expect(agent.examples).toEqual([]);
});
test("composition: core reviewer projects the native OpenCode turn cap and its matching prose", () => {
  const stage = successful(parseAgentStage(reviewerStage));
  const projected = successful(projectAuthoredAgent({ ...reviewerPolicyCase, context: reviewerOpenCodeContext, knowledge: reviewerKnowledge, stages: [stage] }));
  expect(projected.resources[0]?.body).toEqual(reviewerPolicyCase.expected);
  expect(projected.participation).toEqual([{ origin: reviewerStage.origin, stage: "code-generation", mode: "subagent", role: "reviewer" }]);
});
test("composition: Rin customer retains its authored read-only tool allowlist on Claude", () => {
  const projected = successful(projectAuthoredAgent({ ...customerPolicyCase, context: claudeAgentContext, knowledge: [], stages: [] }));
  expect(projected.resources[0]?.body).toEqual(customerPolicyCase.expected);
});
test.each(omittedPolicyCases)("composition: unverified ambient-instruction policy is an explicit refusal: $origin.path", (entry) => {
  expect(projectAuthoredAgent({ ...entry, context: claudeAgentContext, knowledge: [], stages: [] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: entry.expectedName, detail: "claude has no verified native projection for authored omitClaudeMd; prepare an explicit compatible policy before projecting this agent" }] });
});
