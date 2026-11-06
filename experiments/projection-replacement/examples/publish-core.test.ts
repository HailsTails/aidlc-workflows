import { expect, mock, test } from "bun:test";
import { createCorePublicationServices, formatCorePublication } from "./publish-core.ts";
import { assembleAuthoredCoreDistribution, createCoreDistributionServices } from "./core-distribution.ts";
import { createDescribedCoreDistributionServices } from "./described-core-distribution.ts";
import { publishedWorkflow, workflowBuildRequest } from "../__tests__/workflow-publication-fixtures.ts";
test("source metadata selects a distinct Core producer factory without changing retained mode", () => {
  const request = { ...workflowBuildRequest, distributionMetadata: "prepare-source" } as const, createAssembly = mock().mockReturnValue(mock());
  createCorePublicationServices({ request, createAssembly });
  expect(createAssembly).toHaveBeenCalledWith({ request, assemble: assembleAuthoredCoreDistribution, createServices: createDescribedCoreDistributionServices });
});
test("Core source context keeps the authored Core assembler and services profile", () => {
  const request = { ...workflowBuildRequest, runtimeContext: "prepare-source" } as const, assemble = mock(), createAssembly = mock().mockReturnValue(assemble);
  expect(createCorePublicationServices({ request, createAssembly }).assemble).toBe(assemble);
  expect(createAssembly.mock.calls).toEqual([[{ request, assemble: assembleAuthoredCoreDistribution, createServices: createCoreDistributionServices }]]);
});
test("Core publication uses the authored Core assembler", () => {
  expect(createCorePublicationServices({ request: workflowBuildRequest })).toMatchObject({ assemble: assembleAuthoredCoreDistribution });
});
test("Core report preserves the common formatter with an explicit profile scope", () => {
  const format = mock().mockReturnValue("core-report\n");
  expect(formatCorePublication({ published: publishedWorkflow, publicationPath: "core.sqlite", format })).toBe("core-report\n");
  expect(format).toHaveBeenCalledWith({ published: publishedWorkflow, publicationPath: "core.sqlite", scope: "core-authored-selected-surfaces" });
});
