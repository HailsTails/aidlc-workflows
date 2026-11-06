import { expect, test } from "bun:test";
import { projectAgentFromPluginRoles } from "./plugin-role-projection.ts";
import { successful } from "../__tests__/support.ts";
import { pluginRoleContract, roleActor, roleOrigin } from "../__tests__/plugin-role-fixtures.ts";
import { claudeAgentContext, methodologyKnowledge, cursorAgentContext } from "../__tests__/agent-fixtures.ts";

test("composition: transported roles feed real agent preparation and Claude emission", () => {
  const projected = successful(projectAgentFromPluginRoles({ contract: pluginRoleContract, actor: roleActor, context: claudeAgentContext, knowledge: [methodologyKnowledge] }));
  expect(projected.participation).toEqual([
    { origin: roleOrigin, stage: "test-pro-integration", mode: "inline", role: "lead" },
    { origin: roleOrigin, stage: "test-pro-integration", mode: "inline", role: "reviewer" },
  ]);
  expect(projected.resources[0]?.body).toContain("model: sonnet");
});
test("composition: a role reference cannot approve otherwise unsupported host policy", () => {
  expect(projectAgentFromPluginRoles({ contract: pluginRoleContract, actor: { ...roleActor, agent: { ...roleActor.agent, policy: { ...roleActor.agent.policy, tools: { kind: "allow", names: ["Read"] } } } }, context: cursorAgentContext, knowledge: [methodologyKnowledge] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "cursor has no verified native projection for authored tools allowlist; prepare an explicit compatible policy before projecting this agent" }] });
});
