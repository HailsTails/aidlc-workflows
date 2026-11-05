import { expect, test, mock } from "bun:test";
import { scopeSet } from "../__tests__/scope-fixtures.ts";
import { stageSet, stageAuthoring } from "../__tests__/stage-fixtures.ts";
import { assembleWorkflowDistribution, createWorkflowDistributionServices } from "./workflow-distribution.ts";
import { createWorkflowDistributionFixture, workflowArtifact, runtimeWorkflow, hydratedWorkflowSeed } from "../__tests__/workflow-runtime-fixtures.ts";
import { distributionLocation, distributionSeed } from "../__tests__/distribution-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { successful } from "../__tests__/support.ts";
test("native-supplied stage selection preserves the existing producer path without claiming stage projection", async () => {
  const services = createWorkflowDistributionFixture();
  expect(successful(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", services })).stageDocuments).toEqual({ kind: "native-supplied" });
  expect(services.stages).not.toHaveBeenCalled();
});
test("hands compiled preparation to a private artifact producer and returns distinct provenance", async () => {
  const services = createWorkflowDistributionFixture();
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", services })).toEqual({ status: "ok", value: { artifact: workflowArtifact, workflow: runtimeWorkflow, scopes: scopeSet, stageDocuments: { kind: "projected", projection: stageSet, authoring: stageAuthoring, commands: null }, preparation: { compiledPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"], addedPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"] } } });
  expect(services.assemble).toHaveBeenCalledWith({ seed: hydratedWorkflowSeed, definitions: scopeSet, location: { ...distributionLocation, root: "private-root/runtime" }, mode: 0o644, modelInvocation: "native-default" });
});
test("an unavailable native runtime does not trigger compilation", async () => {
  const services = createWorkflowDistributionFixture();
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", services: { ...services, source: { load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.compiler.compile).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
});
test("a source compiler refusal cannot produce an archive from old native data", async () => {
  const services = createWorkflowDistributionFixture();
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", services: { ...services, compiler: { compile: mock().mockReturnValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.prepare).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
});
test("preparation conflicts stop private staging and artifact assembly", async () => {
  const services = createWorkflowDistributionFixture();
  const workspace = { run: mock().mockResolvedValue(runnerFailure) };
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", services: { ...services, prepare: mock().mockReturnValue(runnerFailure), workspace } })).toEqual(runnerFailure);
  expect(workspace.run).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
});
test("production factory provides compiler, native transport and scoped workspace ports", () => {
  expect(createWorkflowDistributionServices()).toMatchObject({ compiler: { compile: expect.any(Function) }, source: { load: expect.any(Function) }, prepare: expect.any(Function), workspace: { run: expect.any(Function) }, assemble: expect.any(Function) });
});
