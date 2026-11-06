import { expect, test } from "bun:test";
import { metricsAgent, claudeAgentContext, cursorAgentContext } from "../../__tests__/agent-fixtures.ts";
import { resolveAgentPolicy } from "./agent-policy.ts";

test("ordinary authored defaults remain applicable across harnesses", () => {
  expect(resolveAgentPolicy({ agent: metricsAgent, context: cursorAgentContext })).toEqual({ status: "ok", value: metricsAgent.policy });
});
test("Claude retains an explicit tool allowlist and native turn limit", () => {
  expect(resolveAgentPolicy({ agent: { ...metricsAgent, policy: { ...metricsAgent.policy, tools: { kind: "allow", names: ["Read", "Grep", "Glob"] }, turnLimit: 60 } }, context: claudeAgentContext })).toEqual({ status: "ok", value: { ...metricsAgent.policy, tools: { kind: "allow", names: ["Read", "Grep", "Glob"] }, turnLimit: 60 } });
});
test.each([
  { policy: { ...metricsAgent.policy, turnLimit: 60 }, field: "maxTurns" },
  { policy: { ...metricsAgent.policy, tools: { kind: "allow" as const, names: ["Read" as const] } }, field: "tools allowlist" },
  { policy: { ...metricsAgent.policy, ambientInstructions: "omit-claude-md" as const }, field: "omitClaudeMd" },
])("unsupported authored policies refuse with specific guidance: $field", ({ policy, field }) => {
  expect(resolveAgentPolicy({ agent: { ...metricsAgent, policy }, context: cursorAgentContext })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: metricsAgent.name, detail: `cursor has no verified native projection for authored ${field}; prepare an explicit compatible policy before projecting this agent` }] });
});
test("omitClaudeMd remains an explicit gap even for Claude until its native meaning is verified", () => {
  expect(resolveAgentPolicy({ agent: { ...metricsAgent, policy: { ...metricsAgent.policy, ambientInstructions: "omit-claude-md" } }, context: claudeAgentContext })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: metricsAgent.name, detail: "claude has no verified native projection for authored omitClaudeMd; prepare an explicit compatible policy before projecting this agent" }] });
});
test("OpenCode admits its verified steps projection", () => {
  expect(resolveAgentPolicy({ agent: { ...metricsAgent, policy: { ...metricsAgent.policy, turnLimit: 60 } }, context: { ...claudeAgentContext, harness: "opencode", directory: ".aidlc" } })).toEqual({ status: "ok", value: { ...metricsAgent.policy, turnLimit: 60 } });
});
