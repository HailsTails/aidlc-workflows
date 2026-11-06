import { prepareCompiledWorkflowReferenceRuntime } from "./workflow-reference-runtime.ts";
import { referenceWorkflowSeed, referenceRuntimePreparation, createReferenceConsumingWorkspace } from "../__tests__/workflow-reference-runtime-fixtures.ts";
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
  expect(services.methods).not.toHaveBeenCalled();
  expect(services.references).not.toHaveBeenCalled();
});
test("hands compiled preparation to a private artifact producer and returns distinct provenance", async () => {
  const services = createWorkflowDistributionFixture();
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", services })).toEqual({ status: "ok", value: { artifact: workflowArtifact, workflow: runtimeWorkflow, scopes: scopeSet, methodRuntime: { kind: "native-supplied" }, workflowReferences: { kind: "native-supplied" }, stageDocuments: { kind: "projected", projection: stageSet, authoring: stageAuthoring, commands: null }, preparation: { compiledPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"], addedPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"] } } });
  expect(services.assemble).toHaveBeenCalledWith({ seed: hydratedWorkflowSeed, workflow: runtimeWorkflow, authoring: stageAuthoring, methodRuntime: { kind: "native-supplied" }, workflowReferences: { kind: "native-supplied" }, definitions: scopeSet, location: { ...distributionLocation, root: "private-root/runtime" }, mode: 0o644, modelInvocation: "native-default" });
});
test("an unavailable native runtime does not trigger compilation", async () => {
  const services = createWorkflowDistributionFixture();
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", services: { ...services, source: { load: mock().mockResolvedValue(runnerFailure) } } })).toEqual(runnerFailure);
  expect(services.compiler.compile).not.toHaveBeenCalled();
  expect(services.methods).not.toHaveBeenCalled();
  expect(services.references).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
});
test("authored method preparation is forwarded before scope projection with distinct provenance", async () => {
  const preparedSeed = { ...distributionSeed, files: [...distributionSeed.files, { path: ".claude/tools/data/memory-seed/org.md", bytes: new Uint8Array([7]), mode: 0o644 }] };
  const preparation = { kind: "prepared" as const, paths: [".claude/tools/data/memory-seed/org.md"], inputs: [{ path: "core/memory/org.md", sha256: "raw-source-digest" }] };
  const services = { ...createWorkflowDistributionFixture(), methods: mock().mockResolvedValue({ status: "ok", value: { seed: preparedSeed, preparation } }) };
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", methodRuntime: "prepare-authored", services })).toMatchObject({ status: "ok", value: { methodRuntime: preparation } });
  expect(services.methods).toHaveBeenCalledWith({ sourceRoot: "source", seed: distributionSeed, mode: 0o644 });
  expect(services.scopes).toHaveBeenCalledWith({ sourceRoot: "source", seed: preparedSeed, workflow: runtimeWorkflow, mode: 0o644 });
});
test("method preparation refusal stops compilation and publication assembly", async () => {
  const services = { ...createWorkflowDistributionFixture(), methods: mock().mockResolvedValue(runnerFailure) };
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", methodRuntime: "prepare-authored", services })).toEqual(runnerFailure);
  expect(services.methods).toHaveBeenCalledWith({ sourceRoot: "source", seed: distributionSeed, mode: 0o644 });
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
  expect(createWorkflowDistributionServices()).toMatchObject({ references: prepareCompiledWorkflowReferenceRuntime, compiler: { compile: expect.any(Function) }, source: { load: expect.any(Function) }, prepare: expect.any(Function), workspace: { run: expect.any(Function) }, assemble: expect.any(Function) });
});

test("explicit compiled reference preparation receives fresh compiler and scope facts before final assembly", async () => {
  const services = { ...createWorkflowDistributionFixture(), references: mock().mockResolvedValue({ status: "ok", value: { seed: referenceWorkflowSeed, preparation: referenceRuntimePreparation } }), workspace: createReferenceConsumingWorkspace() };
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", workflowReferences: "prepare-compiled", services })).toMatchObject({ status: "ok", value: { workflowReferences: referenceRuntimePreparation } });
  expect(services.references).toHaveBeenCalledWith({ sourceRoot: "source", seed: hydratedWorkflowSeed, workflow: runtimeWorkflow, scopeFiles: scopeSet.resources, authoring: stageAuthoring, mode: 0o644 });
  expect(services.workspace.run).toHaveBeenCalledWith({ sourceRoot: "source", seed: referenceWorkflowSeed, consume: expect.any(Function) });
  expect(services.assemble).toHaveBeenCalledWith({ seed: referenceWorkflowSeed, definitions: scopeSet, location: { ...distributionLocation, root: "private-reference-workflow" }, mode: 0o644, modelInvocation: "native-default", workflow: runtimeWorkflow, authoring: stageAuthoring, methodRuntime: { kind: "native-supplied" }, workflowReferences: referenceRuntimePreparation });
});
test("compiled reference refusal stops final runtime staging and publication assembly", async () => {
  const services = { ...createWorkflowDistributionFixture(), references: mock().mockResolvedValue(runnerFailure), workspace: { run: mock() } };
  expect(await assembleWorkflowDistribution({ location: distributionLocation, binding: distributionSeed.binding, contextRoot: "compile-context", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", workflowReferences: "prepare-compiled", services })).toEqual(runnerFailure);
  expect(services.workspace.run).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
});
