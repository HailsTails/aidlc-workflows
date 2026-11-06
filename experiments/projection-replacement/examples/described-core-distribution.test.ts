import { expect, mock, test } from "bun:test";
import { createDescribedCoreDistributionServices, createCoreDescriptionServices } from "./described-core-distribution.ts";
import { createWorkflowDistributionFixture } from "../__tests__/workflow-runtime-fixtures.ts";
import { createCoreDocumentDistributionFixture, coreAssemblyRequest } from "../__tests__/core-distribution-fixtures.ts";
import { createDescriptionFixture } from "../__tests__/distribution-description-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { claudeDistributionDescriptionPaths } from "../src/domain/distribution-description.ts";
import { prepareDistributionStructure } from "../src/domain/distribution-structure.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
test("the described producer injects its metadata owner into the Core assembly", async () => {
  const workflowServices = createWorkflowDistributionFixture(), coreServices = createCoreDocumentDistributionFixture(), descriptionServices = createDescriptionFixture();
  const workflow = mock().mockReturnValue(workflowServices), core = mock().mockReturnValue(coreServices), description = mock().mockReturnValue(descriptionServices), assemble = mock().mockResolvedValue(runnerFailure);
  const services = createDescribedCoreDistributionServices({ workflow, core, description, assemble });
  expect(await services.assemble(coreAssemblyRequest)).toEqual(runnerFailure);
  expect(workflow).toHaveBeenCalledTimes(1);
  expect(core).toHaveBeenCalledTimes(1);
  expect(description).toHaveBeenCalledWith({ rules: coreServices.rules });
  expect(assemble).toHaveBeenCalledWith({ ...coreAssemblyRequest, services: { ...coreServices, description: descriptionServices } });
  expect(services.source).toBe(workflowServices.source);
});
test("the description factory wires canonical domain planners and its injected preparation constructor", () => {
  const description = createDescriptionFixture(), preparation = mock().mockReturnValue(description.preparation);
  expect(createCoreDescriptionServices({ rules: description.rules, preparation })).toEqual({ preparation: description.preparation, paths: claudeDistributionDescriptionPaths, structure: prepareDistributionStructure, admit: planPreparedRuntimeFiles, rules: description.rules });
  expect(preparation).toHaveBeenCalledTimes(1);
});
test("retains shared compilation and source capabilities with an explicit described Core assembler", () => {
  expect(createDescribedCoreDistributionServices()).toMatchObject({ source: { load: expect.any(Function) }, compiler: { compile: expect.any(Function) }, assemble: expect.any(Function), workspace: { run: expect.any(Function) } });
});
