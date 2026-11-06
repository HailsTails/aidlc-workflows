import { expect, mock, test } from "bun:test";
import { buildCore, createCoreBuildDependencies } from "./build-core.ts";
import { createCorePublicationServices, formatCorePublication } from "./publish-core.ts";
import { createWorkflowBuildFixture } from "../__tests__/workflow-publication-fixtures.ts";
test("Core CLI delegates lifecycle and request execution to the shared builder", async () => {
  const dependencies = createWorkflowBuildFixture(), build = mock().mockResolvedValue(undefined);
  await buildCore({ argv: ["core.json"], dependencies, build });
  expect(build).toHaveBeenCalledWith({ argv: ["core.json"], dependencies });
});
test("production Core CLI selects the Core publication and report profile", () => {
  expect(createCoreBuildDependencies()).toMatchObject({ services: createCorePublicationServices, format: formatCorePublication });
});
