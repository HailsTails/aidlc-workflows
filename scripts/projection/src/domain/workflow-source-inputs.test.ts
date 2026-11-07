import { expect, test } from "bun:test";
import { bindWorkflowSourceInputs } from "./workflow-source-inputs.ts";
import { stageSources, stageWorkflow } from "../../../../tests/unit/projection/support/__tests__/stage-fixtures.ts";
import { scopeSources } from "../../../../tests/unit/projection/support/__tests__/scope-fixtures.ts";
test("authored stage witnesses bind independently of compiler module inputs", () => {
  expect(bindWorkflowSourceInputs({ inputs: stageSources.inputs, workflow: stageWorkflow, directory: "core/aidlc-common/stages" })).toEqual({ status: "ok", value: stageSources.inputs });
});
test("another definition namespace cannot satisfy stage input witnesses", () => {
  expect(bindWorkflowSourceInputs({ inputs: scopeSources.inputs, workflow: stageWorkflow, directory: "core/aidlc-common/stages" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "stage-sources", detail: "authored stage inventory and bytes must match the workflow compiler's stage witnesses; retry from stable source inputs" }] });
});
