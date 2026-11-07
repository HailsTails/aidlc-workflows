import { expect, test } from "bun:test";
import { renderStageDefinition, bindStageInputs } from "../../../../../scripts/projection/src/domain/stage-definition.ts";
import { authoredStage, stageProjection, stageSources, stageWorkflow } from "../../support/__tests__/stage-fixtures.ts";
import { scopeContext } from "../../support/__tests__/scope-fixtures.ts";
test("stage prose projection preserves authored dispatch, reviewer and approval guidance", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: scopeContext })).toEqual({ status: "ok", value: stageProjection });
});
test("stage source binding accepts exact compiler witnesses", () => {
  expect(bindStageInputs({ sources: stageSources, workflow: stageWorkflow })).toEqual({ status: "ok", value: stageSources });
});
test("changed source bytes cannot be shipped beside a stale compiled stage graph", () => {
  expect(bindStageInputs({ sources: { ...stageSources, inputs: [{ path: "core/aidlc-common/stages/construction/code-generation.md", sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }] }, workflow: stageWorkflow })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "stage-sources", detail: "authored stage inventory and bytes must match the workflow compiler's stage witnesses; retry from stable source inputs" }] });
});
test("direct rendering cannot bypass the unavailable native-release route preparation", () => {
  expect(renderStageDefinition({ stage: authoredStage, context: { ...scopeContext, invocation: "aidlc" } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "core/aidlc-common/stages/construction/code-generation.md", detail: "native stage emission requires source-owned command preparation bound to this prose and path" }] });
});
