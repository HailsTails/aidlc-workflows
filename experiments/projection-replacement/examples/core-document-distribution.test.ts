import { expect, mock, test } from "bun:test";
import { assembleCoreDocumentDistribution, createCoreProjectionCompletion } from "./core-document-distribution.ts";
import { coreAssemblyRequest, corePreparedDocuments, createCoreDocumentDistributionFixture, createCoreAssembler, coreAdmittedFile, coreHydratedSeed, coreCombinedProjection } from "../__tests__/core-distribution-fixtures.ts";
import { workflowArtifact } from "../__tests__/workflow-runtime-fixtures.ts";
import { scopeSet } from "../__tests__/scope-fixtures.ts";
import { runnerFailure } from "../__tests__/runner-fixtures.ts";
import { contextInputPreparation } from "../__tests__/distribution-context-fixtures.ts";
import { assetInputPreparation } from "../__tests__/runtime-asset-delivery-fixtures.ts";
import { createDescriptionFixture, preparedDescription } from "../__tests__/distribution-description-fixtures.ts";
test("late metadata preparation receives the combined projection and private workspace", async () => {
  const describedSeed = { ...coreAssemblyRequest.seed, files: [...coreAssemblyRequest.seed.files, ...preparedDescription.files], inputPreparations: [preparedDescription.preparation] };
  const description = createDescriptionFixture(), services = { ...createCoreDocumentDistributionFixture(), description, describe: mock().mockResolvedValue({ status: "ok", value: describedSeed }), combine: mock().mockReturnValue({ status: "ok", value: coreCombinedProjection }) };
  const finish = createCoreProjectionCompletion({ documents: corePreparedDocuments, services, workRoot: "private-runtime" });
  expect(await finish({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: scopeSet, mode: 0o644 })).toEqual({ status: "ok", value: workflowArtifact });
  expect(services.describe).toHaveBeenCalledWith({ request: { sourceRoot: "source", root: "private-runtime", seed: coreAssemblyRequest.seed, projection: coreCombinedProjection, mode: 0o644 }, services: description });
  expect(services.finish).toHaveBeenCalledWith({ sourceRoot: "source", seed: describedSeed, projection: coreCombinedProjection, mode: 0o644 });
});
test("selected metadata cannot allocate its scratch state inside source by omission", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), description: createDescriptionFixture() };
  const finish = createCoreProjectionCompletion({ documents: corePreparedDocuments, services });
  expect(await finish({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: scopeSet, mode: 0o644 })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "distribution-description", detail: "Core description finalization requires the existing private runtime workspace" }] });
  expect(services.describe).not.toHaveBeenCalled();
  expect(services.finish).not.toHaveBeenCalled();
});
test("late metadata refusal prevents the archive and ownership finish", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), description: createDescriptionFixture(), describe: mock().mockResolvedValue(runnerFailure) };
  const finish = createCoreProjectionCompletion({ documents: corePreparedDocuments, services, workRoot: "private-runtime" });
  expect(await finish({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: scopeSet, mode: 0o644 })).toEqual(runnerFailure);
  expect(services.finish).not.toHaveBeenCalled();
});
test("late producer observations join the final source digest groups", async () => {
  const assembled = mock().mockResolvedValue({ status: "ok", value: { ...workflowArtifact, inputPreparations: [preparedDescription.preparation] } });
  const services = { ...createCoreDocumentDistributionFixture(), assembler: mock().mockReturnValue(assembled) };
  await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, services });
  expect(services.digests).toHaveBeenLastCalledWith({ groups: [[{ path: "observed-source", sha256: "source-digest" }], preparedDescription.preparation.inputs] });
  expect(services.digests).toHaveBeenCalledTimes(2);
});
test("nonempty context source witnesses join the Core digest groups", async () => {
  const services = createCoreDocumentDistributionFixture();
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, seed: { ...coreAssemblyRequest.seed, inputPreparations: [contextInputPreparation, assetInputPreparation] }, services })).toEqual({ status: "ok", value: { ...workflowArtifact, sourceInputs: [{ path: "observed-source", sha256: "source-digest" }] } });
  expect(services.digests).toHaveBeenCalledWith({ groups: [coreAssemblyRequest.workflow.inputs, coreAssemblyRequest.authoring?.inputs, [], [], [{ path: "scripts/harness-runtime-data.ts", sha256: "source-descriptor-api" }, { path: "core/tools/data/model-rates.json", sha256: "rates-source" }], corePreparedDocuments.inputs] });
});
test("hydrates authored documents before the existing runner preparation and retains all input witnesses", async () => {
  const services = createCoreDocumentDistributionFixture(), assemble = createCoreAssembler();
  const configured = { ...services, admit: mock().mockReturnValue({ status: "ok", value: { additions: [coreAdmittedFile], unchanged: [] } }), assembler: mock().mockReturnValue(assemble) };
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, services: configured })).toEqual({ status: "ok", value: { ...workflowArtifact, sourceInputs: [{ path: "observed-source", sha256: "source-digest" }] } });
  expect(services.documents).toHaveBeenCalledWith({ sourceRoot: "source", workRoot: coreAssemblyRequest.location.root, basis: coreAssemblyRequest.seed.basis, context: { harness: "claude", directory: ".claude", invocation: "aidlc", rulesSubdir: "rules", optionLetters: coreAssemblyRequest.authoring?.optionLetters }, workflow: coreAssemblyRequest.workflow, mode: 0o644 });
  expect(services.digests).toHaveBeenCalledWith({ groups: [coreAssemblyRequest.workflow.inputs, coreAssemblyRequest.authoring?.inputs, [], [], [], corePreparedDocuments.inputs] });
  expect(configured.admit).toHaveBeenCalledWith({ candidates: corePreparedDocuments.projection.resources, inventory: coreAssemblyRequest.seed, mode: 0o644, rules: services.rules });
  expect(services.workspace.run).toHaveBeenCalledWith({ sourceRoot: "source", seed: coreHydratedSeed, consume: expect.any(Function) });
  expect(assemble).toHaveBeenCalledWith({ ...coreAssemblyRequest, seed: coreHydratedSeed, location: { ...coreAssemblyRequest.location, root: "private-core" } });
});
test("missing authored context is refused before document I/O", async () => {
  const services = createCoreDocumentDistributionFixture();
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, authoring: null, services })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "authored-core", detail: "the authored Core profile requires freshly prepared stage authoring and method runtime context" }] });
  expect(services.documents).not.toHaveBeenCalled();
});
test("document refusal prevents staging a successful subset", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), documents: mock().mockResolvedValue(runnerFailure) };
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, services })).toEqual(runnerFailure);
  expect(services.admit).not.toHaveBeenCalled();
  expect(services.assembler).not.toHaveBeenCalled();
});
test("conflicting source observations prevent file admission", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), digests: mock().mockReturnValue(runnerFailure) };
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, services })).toEqual(runnerFailure);
  expect(services.admit).not.toHaveBeenCalled();
});
test("changed authored destination bytes prevent Core assembly", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), admit: mock().mockReturnValue(runnerFailure) };
  expect(await assembleCoreDocumentDistribution({ ...coreAssemblyRequest, services })).toEqual(runnerFailure);
  expect(services.assembler).not.toHaveBeenCalled();
});
test("one shared completion receives the combined projection", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), combine: mock().mockReturnValue({ status: "ok", value: coreCombinedProjection }) };
  const finish = createCoreProjectionCompletion({ documents: corePreparedDocuments, services });
  expect(await finish({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: scopeSet, mode: 0o644 })).toEqual({ status: "ok", value: workflowArtifact });
  expect(services.combine).toHaveBeenCalledWith({ target: scopeSet.target, sets: [scopeSet, corePreparedDocuments.projection] });
  expect(services.finish).toHaveBeenCalledWith({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: coreCombinedProjection, mode: 0o644 });
});
test("composition refusal prevents generic issuance", async () => {
  const services = { ...createCoreDocumentDistributionFixture(), combine: mock().mockReturnValue(runnerFailure) };
  const finish = createCoreProjectionCompletion({ documents: corePreparedDocuments, services });
  expect(await finish({ sourceRoot: "source", seed: coreAssemblyRequest.seed, projection: scopeSet, mode: 0o644 })).toEqual(runnerFailure);
  expect(services.finish).not.toHaveBeenCalled();
});
