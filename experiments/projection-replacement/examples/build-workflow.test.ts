import { expect, mock, test } from "bun:test";
import { buildWorkflow } from "./build-workflow.ts";
import { createWorkflowBuildFixture, workflowBuildFailure } from "../__tests__/workflow-publication-fixtures.ts";
test("the command reports a published initial artifact", async () => {
  const dependencies = createWorkflowBuildFixture();
  await buildWorkflow({ argv: ["request.json"], dependencies });
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: { status: "ok", value: "published\n" } });
});
test("input refusal cannot create publication services", async () => {
  const dependencies = createWorkflowBuildFixture();
  await buildWorkflow({ argv: [], dependencies: { ...dependencies, reader: { load: mock().mockResolvedValue(workflowBuildFailure) } } });
  expect(dependencies.services).not.toHaveBeenCalled();
  expect(dependencies.publish).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: workflowBuildFailure });
});
test("publication refusal cannot become a success report", async () => {
  const dependencies = createWorkflowBuildFixture();
  await buildWorkflow({ argv: ["request.json"], dependencies: { ...dependencies, publish: mock().mockResolvedValue(workflowBuildFailure) } });
  expect(dependencies.format).not.toHaveBeenCalled();
  expect(dependencies.reporter.finish).toHaveBeenCalledWith({ outcome: workflowBuildFailure });
});
