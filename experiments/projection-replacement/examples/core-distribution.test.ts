import { assembleCoreDocumentDistribution } from "./core-document-distribution.ts";
import { expect, mock, test } from "bun:test";
import { assembleAuthoredCoreDistribution, createCoreDistributionServices } from "./core-distribution.ts";
import { distributionLocation, distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { createWorkflowDistributionFixture } from "../__tests__/workflow-runtime-fixtures.ts";
import { workflowBuildFailure } from "../__tests__/workflow-publication-fixtures.ts";
test("Core profile delegates to the shared workflow pipeline with authored requirements", async () => {
  const services = createWorkflowDistributionFixture(), assemble = mock().mockResolvedValue(workflowBuildFailure);
  expect(await assembleAuthoredCoreDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "private", mode: 0o644, modelInvocation: "native-default", services, assemble })).toEqual(workflowBuildFailure);
  expect(assemble).toHaveBeenCalledWith({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "private", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", methodRuntime: "prepare-authored", services });
});
test.each([
  [{ binding: { harness: "cursor", directory: ".cursor" } }],
  [{ stageDocuments: "native-supplied" }],
  [{ methodRuntime: "native-supplied" }],
  [{ modelInvocation: "disabled" }],
] as const)("refuses unsupported Core profile variants without invoking assembly: %j", async (variant) => {
  const assemble = mock();
  await expect(assembleAuthoredCoreDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "private", mode: 0o644, modelInvocation: "native-default", ...variant, assemble })).resolves.toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "authored-core", detail: "the authored Core profile qualifies Claude copy delivery with authored stages, prepared method runtime and native-default invocation; use the workflow profile for retained preparations" }] });
  expect(assemble).not.toHaveBeenCalled();
});
test("Core production wiring keeps the shared workflow capabilities", () => {
  expect(createCoreDistributionServices()).toMatchObject({ source: { load: expect.any(Function) }, compiler: { compile: expect.any(Function) }, methods: expect.any(Function), assemble: assembleCoreDocumentDistribution });
});
