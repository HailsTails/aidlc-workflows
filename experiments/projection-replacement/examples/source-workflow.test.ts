import { expect, mock, test } from "bun:test";
import { compileSourceWorkflowCatalogue } from "./source-workflow.ts";
import { compiledWorkflow, workflowLocation, workflowCatalogue } from "../__tests__/workflow-compiler-fixtures.ts";
import { distributionBasis } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
test("passes compiled source data into the existing participation catalogue boundary", () => {
  const parse = mock().mockReturnValue({ status: "ok", value: workflowCatalogue });
  expect(compileSourceWorkflowCatalogue({ location: workflowLocation, sources: [distributionBasis], compiler: { compile: mock().mockReturnValue({ status: "ok", value: compiledWorkflow }) }, parse })).toEqual({ status: "ok", value: { workflow: compiledWorkflow, catalogue: workflowCatalogue } });
  expect(parse).toHaveBeenCalledWith({ text: compiledWorkflow.graph.text, artifact: compiledWorkflow.graph.origin, binding: workflowLocation.binding, sources: [distributionBasis] });
});
test("native preparation failure stops catalogue admission", () => {
  const parse = mock();
  expect(compileSourceWorkflowCatalogue({ location: workflowLocation, sources: [distributionBasis], compiler: { compile: mock().mockReturnValue(runnerFailure) }, parse })).toEqual(runnerFailure);
  expect(parse).not.toHaveBeenCalled();
});
test("composition: actual compiled-stage reader admits graph data without native agent profiles", () => {
  expect(compileSourceWorkflowCatalogue({ location: workflowLocation, sources: [distributionBasis], compiler: { compile: mock().mockReturnValue({ status: "ok", value: compiledWorkflow }) } })).toEqual({ status: "ok", value: { workflow: compiledWorkflow, catalogue: workflowCatalogue } });
});
test("composition: an artifact pin cannot supply missing definition provenance", () => {
  expect(compileSourceWorkflowCatalogue({ location: workflowLocation, sources: [], compiler: { compile: mock().mockReturnValue({ status: "ok", value: compiledWorkflow }) } })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "code-generation", detail: "compiled stage owner core:framework requires an explicit source pin; the artifact pin does not establish definition provenance" }] });
});
