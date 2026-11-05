import { expect, test } from "bun:test";
import { projectProjectionSet } from "./projection-set.ts";
import { assemblyAgentUnit, assemblySkillUnit, assemblyTarget } from "../__tests__/projection-set-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { customerPolicyCase, reviewerOpenCodeContext } from "../__tests__/agent-policy-cases.ts";
import { parseAgentSource } from "../src/adapters/agent-source.ts";
test("composition: real agent and authored skill projectors assemble native files", () => {
  const projected = successful(projectProjectionSet({ target: assemblyTarget, units: [assemblyAgentUnit, assemblySkillUnit] }));
  expect(projected.resources).toHaveLength(2);
  expect(projected.resources[0]?.path).toEqual(".claude/agents/test-pro-metrics-agent.md");
  expect(projected.resources[1]?.path).toEqual(".claude/skills/aidlc-session-cost/SKILL.md");
  expect(projected.scope).toEqual("selected-surfaces");
});
test("composition: real reviewer policy refusal blocks the whole assembly", () => {
  const agent = successful(parseAgentSource(customerPolicyCase));
  expect(projectProjectionSet({ target: { harness: "opencode", directory: ".aidlc" }, units: [{ kind: "agent", key: "reviewer", input: { agent, context: reviewerOpenCodeContext, knowledge: [], stages: [] } }, { ...assemblySkillUnit, input: { ...assemblySkillUnit.input, context: { ...assemblySkillUnit.input.context, harness: "opencode", directory: ".aidlc" } } }] })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "rin-customer-reviewer-agent", detail: "opencode has no verified native projection for authored tools allowlist; prepare an explicit compatible policy before projecting this agent" }] });
});
test("composition: duplicate ownership cannot enter the selected file set", () => {
  expect(projectProjectionSet({ target: assemblyTarget, units: [assemblySkillUnit, { ...assemblySkillUnit, key: "other-skill" }] })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/skills/aidlc-session-cost/SKILL.md", detail: "native file set must emit each destination once" }] });
});
