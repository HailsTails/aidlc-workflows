import { expect, test } from "bun:test";
import { bindPluginRoleAgent, createPluginRoleContract, pluginRoleUses } from "./plugin-role-contract.ts";
import { pluginRoleContract, roleActor, roleFrontend, roleOwner, roleStage, roleUses, portableRoleStage, roleOrigin } from "../../__tests__/plugin-role-fixtures.ts";

test("binds named authored identities without adding harness grants", () => {
  expect(createPluginRoleContract({ owner: roleOwner, sources: [roleOwner], frontend: roleFrontend, stages: [roleStage], actors: [roleActor] })).toEqual({ status: "ok", value: pluginRoleContract });
  expect(pluginRoleUses({ contract: pluginRoleContract })).toEqual(roleUses);
});
test("missing identity is a specific refusal rather than an inferred filename", () => {
  expect(createPluginRoleContract({ owner: roleOwner, sources: [roleOwner], frontend: roleFrontend, stages: [roleStage], actors: [] })).toEqual({ status: "invalid", findings: [
    { code: "capability-gap", subject: "test-pro-metrics-agent", detail: "a declared role requires exactly one authored agent identity in the explicitly selected source catalogue" },
    { code: "capability-gap", subject: "test-pro-metrics-agent", detail: "a declared role requires exactly one authored agent identity in the explicitly selected source catalogue" },
  ] });
});
test("ambiguous identity cannot use catalogue ordering as authority", () => {
  expect(createPluginRoleContract({ owner: roleOwner, sources: [roleOwner], frontend: roleFrontend, stages: [roleStage], actors: [roleActor, roleActor] })).toEqual({ status: "invalid", findings: [
    { code: "duplicate", subject: "test-pro-metrics-agent", detail: "a declared role requires exactly one authored agent identity in the explicitly selected source catalogue" },
    { code: "duplicate", subject: "test-pro-metrics-agent", detail: "a declared role requires exactly one authored agent identity in the explicitly selected source catalogue" },
  ] });
});
test("selected pin cannot be replaced under the same owner", () => {
  expect(createPluginRoleContract({ owner: roleOwner, sources: [{ ...roleOwner, pin: "other" }], frontend: roleFrontend, stages: [roleStage], actors: [roleActor] })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-roles", detail: "declare one exact source basis per selected owner and bind every stage and authored agent to those sources" }] });
});
test("binds participation only to the exact source digest", () => {
  expect(bindPluginRoleAgent({ contract: pluginRoleContract, actor: roleActor })).toEqual({ status: "ok", value: [{ origin: roleOrigin, slug: "test-pro-integration", mode: "inline", lead: "test-pro-metrics-agent", supports: [], reviewer: "test-pro-metrics-agent" }] });
  expect(bindPluginRoleAgent({ contract: pluginRoleContract, actor: { ...roleActor, sha256: "changed" } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "portable role identity must match the exact authored agent source, pin, path and input digest before preparation" }] });
});
test("future topology survives transport but cannot silently become inline participation", () => {
  expect(bindPluginRoleAgent({ contract: { ...pluginRoleContract, stages: [{ ...portableRoleStage, mode: "agent-team" }] }, actor: roleActor })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "test-pro-metrics-agent", detail: "authored topology is preserved but unsupported by current agent participation; no mode was substituted" }] });
});
test("mob lead and support require surfaces independently of permission approval", () => {
  expect(pluginRoleUses({ contract: { ...pluginRoleContract, stages: [{ ...portableRoleStage, mode: "mob", roles: { lead: portableRoleStage.roles.lead, supports: [portableRoleStage.roles.lead], reviewer: null } }] } })).toEqual([
    { ...roleUses[0], mode: "mob", requirement: "native-surface" },
    { ...roleUses[0], mode: "mob", role: "support", requirement: "native-surface" },
  ]);
});
test("inline support remains a persona even when a reviewer needs a surface", () => {
  expect(pluginRoleUses({ contract: { ...pluginRoleContract, stages: [{ ...portableRoleStage, roles: { ...portableRoleStage.roles, supports: [portableRoleStage.roles.lead] } }] } })).toEqual([
    roleUses[0], { ...roleUses[0], role: "support" }, roleUses[1],
  ]);
});
test("an equal digest cannot bypass source pin identity", () => {
  expect(bindPluginRoleAgent({ contract: pluginRoleContract, actor: { ...roleActor, agent: { ...roleActor.agent, origin: { ...roleActor.agent.origin, pin: "other" } } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "test-pro-metrics-agent", detail: "portable role identity must match the exact authored agent source, pin, path and input digest before preparation" }] });
});
