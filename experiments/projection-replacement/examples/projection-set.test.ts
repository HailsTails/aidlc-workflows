import { expect, test } from "bun:test";
import { projectProjectionSet } from "./projection-set.ts";
import { assemblyAgentUnit, assemblySkillUnit, assemblyTarget } from "../__tests__/projection-set-fixtures.ts";
import { successful } from "../__tests__/support.ts";
import { customerPolicyCase, reviewerOpenCodeContext } from "../__tests__/agent-policy-cases.ts";
import { parseAgentSource } from "../src/adapters/agent-source.ts";
test("composition: sensor prose preserves native frontmatter and extension metadata", () => {
  expect(projectProjectionSet({ target: { harness: "claude", directory: ".claude" }, units: [{ kind: "sensor", key: "sensor-example", input: { document: { fileName: "aidlc-example.md", origin: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/sensors/aidlc-example.md" }, text: "---\nid: example\ncommand: {{INVOKE}} engine sensor-example\ncustom: retained\n---\nBody {{HARNESS_DIR}}\n" }, context: { harness: "claude", directory: ".claude", invocation: "bun .claude/tools/aidlc.ts", rulesSubdir: "rules" } } }] })).toEqual({ status: "ok", value: { scope: "selected-surfaces", target: { harness: "claude", directory: ".claude" }, units: [{ kind: "sensor", key: "sensor-example", projection: { origin: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/sensors/aidlc-example.md" }, harness: "claude", resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "---\nid: example\ncommand: bun .claude/tools/aidlc.ts engine sensor-example\ncustom: retained\n---\nBody .claude\n" }] } }], resources: [{ kind: "file", path: ".claude/sensors/aidlc-example.md", body: "---\nid: example\ncommand: bun .claude/tools/aidlc.ts engine sensor-example\ncustom: retained\n---\nBody .claude\n" }] } });
});
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
