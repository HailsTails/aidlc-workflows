import { expect, test } from "bun:test";
import { createPluginRoleCodec } from "./plugin-role-contract.ts";
import { pluginRoleContract, reorderedRoleContract, portableRoleStage, roleReference } from "../../__tests__/plugin-role-fixtures.ts";

test("portable roles round trip without dependence on object key order", () => {
  expect(createPluginRoleCodec().read({ json: createPluginRoleCodec().write({ contract: pluginRoleContract }) })).toEqual({ status: "ok", value: pluginRoleContract });
  expect(createPluginRoleCodec().read({ json: JSON.stringify(reorderedRoleContract) })).toEqual({ status: "ok", value: pluginRoleContract });
});
test("permissions cannot be smuggled into the role transport", () => {
  expect(createPluginRoleCodec().read({ json: JSON.stringify({ ...pluginRoleContract, permissions: { tools: ["all"] } }) })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "plugin-roles", detail: "portable roles require versioned source identities, stage topology, input digests and role references; capabilities and permissions are not accepted fields" }] });
});
test("one name cannot alias two different authored input digests", () => {
  expect(createPluginRoleCodec().read({ json: JSON.stringify({ ...pluginRoleContract, stages: [{ ...portableRoleStage, roles: { ...portableRoleStage.roles, reviewer: { ...roleReference, sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" } } }] }) })).toEqual({ status: "invalid", findings: [{ code: "duplicate", subject: "plugin-roles", detail: "portable stage identities must be unique and each global agent name must resolve to one source reference" }] });
});
test("malformed JSON is reported as data", () => {
  expect(createPluginRoleCodec().read({ json: "{" })).toEqual({ status: "invalid", findings: [{ code: "invalid-json", subject: "plugin-roles", detail: "portable role contract must contain valid JSON" }] });
});
test("a role reference must use the selected owner pin", () => {
  expect(createPluginRoleCodec().read({ json: JSON.stringify({ ...pluginRoleContract, sources: [{ ...pluginRoleContract.owner, pin: "other" }] }) })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-roles", detail: "portable role references must bind to one exact declared source basis per owner" }] });
});
test("duplicate frontend paths cannot stand in for two provenance inputs", () => {
  expect(createPluginRoleCodec().read({ json: JSON.stringify({ ...pluginRoleContract, frontend: { ...pluginRoleContract.frontend, inputs: [pluginRoleContract.frontend.inputs[0], pluginRoleContract.frontend.inputs[0]] } }) })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "plugin-roles", detail: "frontend provenance must witness its declared entrypoint once without duplicate paths" }] });
});
