import { expect, mock, test } from "bun:test";
import { prepareProjectedProducts, requiredProjectedRunnerPaths } from "./projected-products.ts";
import { hiddenRegistrationProjection, pluginProductInput, pluginProductBasis, projectedProductInput, staleCompilerProjection } from "../../__tests__/distribution-product-fixtures.ts";
import { distributionBasis } from "../../__tests__/distribution-fixtures.ts";
import { shortcutProductInput } from "../../__tests__/distribution-product-fixtures.ts";
import { scopeSet, scopeOrigin } from "../../__tests__/scope-fixtures.ts";
test("an authored scope product carries its own producer dependency and source provenance", () => {
  expect(prepareProjectedProducts({ ...projectedProductInput, projection: scopeSet, rules: { encode: mock().mockReturnValue(new Uint8Array([9, 8])) } })).toEqual({ status: "ok", value: [{ key: "scope-bugfix", owner: distributionBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [scopeOrigin], requiredByProducer: [".claude/scopes/aidlc-bugfix.md"], files: [{ path: ".claude/scopes/aidlc-bugfix.md", bytes: new Uint8Array([9, 8]), mode: 0o644 }] }] });
});
test("an authored product preserves its source input and native footprint", () => {
  expect(prepareProjectedProducts({ ...projectedProductInput, rules: { encode: mock().mockReturnValue(new Uint8Array([9, 8])) } })).toEqual({ status: "ok", value: [{ key: "cost", owner: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" }, binding: { harness: "claude", directory: ".claude" }, inputs: [{ source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/skills/aidlc-session-cost/SKILL.md" }], requiredByProducer: [], files: [{ path: ".claude/skills/aidlc-session-cost/SKILL.md", bytes: new Uint8Array([9, 8]), mode: 0o644 }] }] });
});
test("a core compiler and plugin product have distinct source provenance", () => {
  expect(prepareProjectedProducts({ ...pluginProductInput, rules: { encode: mock().mockReturnValue(new Uint8Array([9, 8])) } })).toEqual({ status: "ok", value: [{ key: "rin-gate-0-reconcile", owner: pluginProductBasis, binding: { harness: "claude", directory: ".claude" }, inputs: [{ source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/tools/aidlc-runner-gen.ts" }], requiredByProducer: [".claude/skills/rin-gate-0-reconcile/SKILL.md"], files: [{ path: ".claude/skills/rin-gate-0-reconcile/SKILL.md", bytes: new Uint8Array([9, 8]), mode: 0o644 }] }] });
});
test("a compiler pin cannot substitute for an undeclared plugin owner", () => {
  expect(prepareProjectedProducts({ ...pluginProductInput, sources: [distributionBasis], rules: { encode: mock() } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/rin-gate-0-reconcile/SKILL.md", detail: "declare exactly one plugin or core source basis; a compiler pin cannot supply runner ownership" }] });
});
test("ambiguous plugin pins cannot be selected by array ordering", () => {
  expect(prepareProjectedProducts({ ...pluginProductInput, sources: [pluginProductBasis, { ...pluginProductBasis, pin: "another" }], rules: { encode: mock() } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/skills/rin-gate-0-reconcile/SKILL.md", detail: "declare exactly one plugin or core source basis; a compiler pin cannot supply runner ownership" }] });
});
test("an alternate compiler path cannot bypass the compiler pin guard", () => {
  expect(prepareProjectedProducts({ ...pluginProductInput, projection: staleCompilerProjection, rules: { encode: mock() } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "alternate-compiler.ts", detail: "runner compiler must match the prepared seed's compiler source basis" }] });
});
test("a registration hidden outside the aggregate resource list still refuses", () => {
  expect(prepareProjectedProducts({ ...pluginProductInput, projection: hiddenRegistrationProjection, rules: { encode: mock() } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: ".claude/settings.json", detail: "shared registration fragments need their native owner before becoming distribution products" }] });
});
test("invalid filesystem modes do not become archive permissions", () => {
  expect(prepareProjectedProducts({ ...projectedProductInput, mode: -1, rules: { encode: mock() } })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "distribution-mode", detail: "projected text files require an explicit permission mode between 0 and 0777" }] });
});
test("currently compiled native runner products carry producer requirements", () => {
  expect(requiredProjectedRunnerPaths({ projection: pluginProductInput.projection })).toEqual([".claude/skills/rin-gate-0-reconcile/SKILL.md"]);
  expect(requiredProjectedRunnerPaths({ projection: projectedProductInput.projection })).toEqual([]);
});
test("a generated init shortcut carries the same producer requirement as stage runners", () => {
  expect(requiredProjectedRunnerPaths({ projection: shortcutProductInput.projection })).toEqual([".claude/skills/aidlc-init/SKILL.md"]);
  expect(prepareProjectedProducts({ ...shortcutProductInput, rules: { encode: mock().mockReturnValue(new Uint8Array([9, 8])) } })).toEqual({ status: "ok", value: [{ key: "aidlc-init", owner: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" }, binding: { harness: "claude", directory: ".claude" }, inputs: [{ source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1", path: "core/tools/aidlc-runner-gen.ts" }], requiredByProducer: [".claude/skills/aidlc-init/SKILL.md"], files: [{ path: ".claude/skills/aidlc-init/SKILL.md", bytes: new Uint8Array([9, 8]), mode: 0o644 }] }] });
});
