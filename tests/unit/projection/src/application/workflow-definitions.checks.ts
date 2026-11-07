import { expect, test } from "bun:test";
import { prepareWorkflowDefinitions, mergeWorkflowDefinitions } from "../../../../../scripts/projection/src/application/workflow-definitions.ts";
import { scopeSet, scopeRuntimeFile, scopeRuntimeSeed } from "../../support/__tests__/scope-fixtures.ts";
import { distributionSeed, distributionProjection } from "../../support/__tests__/distribution-fixtures.ts";
import { workflowRuntimeRules } from "../../support/__tests__/workflow-runtime-fixtures.ts";
import { stageSet, stageRuntimeSeed } from "../../support/__tests__/stage-fixtures.ts";
test("authored stages use the same safe preparation boundary as scope definitions", () => {
  expect(prepareWorkflowDefinitions({ seed: { ...distributionSeed, invocation: "bun .claude/tools/aidlc.ts" }, projection: stageSet, mode: 0o644, rules: workflowRuntimeRules })).toEqual({ status: "ok", value: { seed: stageRuntimeSeed, projection: stageSet } });
});
test("definition composition preserves distinct scope and stage product identities", () => {
  expect(mergeWorkflowDefinitions({ first: scopeSet, second: stageSet })).toEqual({ status: "ok", value: { scope: "selected-surfaces", target: distributionSeed.binding, units: [...scopeSet.units, ...stageSet.units], resources: [...scopeSet.resources, ...stageSet.resources] } });
});
test("repeated definition footprints cannot be combined into competing owners", () => {
  expect(mergeWorkflowDefinitions({ first: scopeSet, second: scopeSet })).toEqual({ status: "invalid", findings: [{ code: "destination-collision", subject: ".claude/scopes/aidlc-bugfix.md", detail: "native file set must emit each destination once" }] });
});
test("an absent scope is prepared as an authored projection rather than retained seed bytes", () => {
  expect(prepareWorkflowDefinitions({ seed: distributionSeed, projection: scopeSet, mode: 0o644, rules: workflowRuntimeRules })).toEqual({ status: "ok", value: { seed: scopeRuntimeSeed, projection: scopeSet } });
});
test("an existing changed scope remains a conflict before staging", () => {
  expect(prepareWorkflowDefinitions({ seed: { ...distributionSeed, files: [...distributionSeed.files, { ...scopeRuntimeFile, bytes: new Uint8Array([48]) }] }, projection: scopeSet, mode: 0o644, rules: workflowRuntimeRules })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: ".claude/scopes/aidlc-bugfix.md", detail: "existing prepared file differs from the candidate; preserve it or prepare a fresh staging tree" }] });
});
test("other capabilities cannot pass as scope preparation", () => {
  expect(prepareWorkflowDefinitions({ seed: distributionSeed, projection: distributionProjection, mode: 0o644, rules: workflowRuntimeRules })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-definitions", detail: "workflow definition preparation requires nonempty projected stages or scopes matching the core runtime source basis and binding" }] });
});
