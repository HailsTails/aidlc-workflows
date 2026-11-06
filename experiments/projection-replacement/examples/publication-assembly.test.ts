import { expect, mock, test } from "bun:test";
import { createPublicationAssembler } from "./publication-assembly.ts";
import { createWorkflowDistributionFixture } from "../__tests__/workflow-runtime-fixtures.ts";
import { workflowBuildRequest, workflowBuildResult, workflowBuildFailure } from "../__tests__/workflow-publication-fixtures.ts";
import { distributionLocation, distributionSeed } from "../__tests__/distribution-fixtures.ts";
const input = { location: distributionLocation, binding: distributionSeed.binding, contextRoot: "private-context", mode: 0o644, modelInvocation: "native-default" } as const;
test("settings use the prepared module source before workspace and directory preparation", async () => {
  const services = createWorkflowDistributionFixture(), modules = { load: mock() }, settings = { load: mock() }, seed = { load: mock() }, source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure);
  const createModules = mock().mockReturnValue(modules), createSettings = mock().mockReturnValue(settings), createWorkspaceSeed = mock().mockReturnValue(seed), createStructure = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeModules: "prepare-source", harnessSettings: "prepare-source", workspaceSeed: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } }, assemble, createServices: mock().mockReturnValue(services), createModules, createSettings, createWorkspaceSeed, createStructure });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createSettings.mock.calls).toEqual([[{ source: modules, mode: 0o644 }]]);
  expect(createWorkspaceSeed.mock.calls).toEqual([[{ source: settings, mode: 0o644 }]]);
  expect(createStructure.mock.calls).toEqual([[{ source: seed, structure: { kind: "file-parents", mode: 0o755 } }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("supplied settings preserve the assembler without constructing the source preparer", () => {
  const assemble = mock(), createSettings = mock();
  expect(createPublicationAssembler({ request: { ...workflowBuildRequest, harnessSettings: "native-supplied" }, assemble, createSettings })).toBe(assemble);
  expect(createSettings).not.toHaveBeenCalled();
});

test("workspace seed alone wraps the retained source before publication", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createWorkspaceSeed = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, workspaceSeed: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createWorkspaceSeed });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createWorkspaceSeed.mock.calls).toEqual([[{ source: services.source, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});

test("explicitly supplied workspace seed does not load source or wrap the assembler", () => {
  const assemble = mock(), createWorkspaceSeed = mock();
  expect(createPublicationAssembler({ request: { ...workflowBuildRequest, workspaceSeed: "native-supplied" }, assemble, createWorkspaceSeed })).toBe(assemble);
  expect(createWorkspaceSeed).not.toHaveBeenCalled();
});

test("workspace seed precedes final file-parent directory planning", async () => {
  const services = createWorkflowDistributionFixture(), seed = { load: mock() }, source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createWorkspaceSeed = mock().mockReturnValue(seed), createStructure = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, workspaceSeed: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } }, assemble, createServices: mock().mockReturnValue(services), createWorkspaceSeed, createStructure });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createStructure.mock.calls).toEqual([[{ source: seed, structure: { kind: "file-parents", mode: 0o755 } }]]);
});
test("native context preserves the assembler and does not construct a replacement source", () => {
  const assemble = mock(), createServices = mock(), createSource = mock();
  expect(createPublicationAssembler({ request: workflowBuildRequest, assemble, createServices, createSource })).toBe(assemble);
  expect(createServices).not.toHaveBeenCalled();
  expect(createSource).not.toHaveBeenCalled();
});
test("modules alone compose through the same profile and admission boundary", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createModules = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeModules: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createModules });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createModules.mock.calls).toEqual([[{ source: services.source, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("authoring data alone retains the selected source and publication profile", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createAuthoring = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, pluginAuthoring: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createAuthoring });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createAuthoring.mock.calls).toEqual([[{ source: services.source, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("explicit directory construction wraps the selected source without changing the profile", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createStructure = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, directories: { kind: "file-parents", mode: 0o755 } }, assemble, createServices: mock().mockReturnValue(services), createStructure });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createStructure.mock.calls).toEqual([[{ source: services.source, structure: { kind: "file-parents", mode: 0o755 } }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("directory construction receives the complete accumulated source preparations", async () => {
  const services = createWorkflowDistributionFixture(), context = { load: mock() }, assets = { load: mock() }, contracts = { load: mock() }, modules = { load: mock() }, authoring = { load: mock() }, source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure);
  const createSource = mock().mockReturnValue(context), createAssets = mock().mockReturnValue(assets), createContracts = mock().mockReturnValue(contracts), createModules = mock().mockReturnValue(modules), createAuthoring = mock().mockReturnValue(authoring), createStructure = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContext: "prepare-source", runtimeAssets: "prepare-authored", runtimeContracts: "prepare-source", runtimeModules: "prepare-source", pluginAuthoring: "prepare-source", directories: { kind: "file-parents", mode: 0o755 } }, assemble, createServices: mock().mockReturnValue(services), createSource, createAssets, createContracts, createModules, createAuthoring, createStructure });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createContracts.mock.calls).toEqual([[{ source: assets, mode: 0o644 }]]);
  expect(createModules.mock.calls).toEqual([[{ source: contracts, mode: 0o644 }]]);
  expect(createAuthoring.mock.calls).toEqual([[{ source: modules, mode: 0o644 }]]);
  expect(createStructure.mock.calls).toEqual([[{ source: authoring, structure: { kind: "file-parents", mode: 0o755 } }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("source context changes only source preparation in the selected profile", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue({ status: "ok", value: workflowBuildResult });
  const createServices = mock().mockReturnValue(services), createSource = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContext: "prepare-source" }, assemble, createServices, createSource });
  expect(await selected(input)).toEqual({ status: "ok", value: workflowBuildResult });
  expect(createServices.mock.calls).toEqual([[]]);
  expect(createSource.mock.calls).toEqual([[{ mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("selected profile refusal is returned without retrying another context strategy", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContext: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createSource: mock().mockReturnValue(source) });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("asset-only preparation retains the native context reader", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createSource = mock(), createAssets = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeAssets: "prepare-authored" }, assemble, createServices: mock().mockReturnValue(services), createSource, createAssets });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createSource).not.toHaveBeenCalled();
  expect(createAssets.mock.calls).toEqual([[{ source: services.source, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("source context and assets compose in order in the same profile", async () => {
  const services = createWorkflowDistributionFixture(), context = { load: mock() }, source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createSource = mock().mockReturnValue(context), createAssets = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContext: "prepare-source", runtimeAssets: "prepare-authored" }, assemble, createServices: mock().mockReturnValue(services), createSource, createAssets });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createSource.mock.calls).toEqual([[{ mode: 0o644 }]]);
  expect(createAssets.mock.calls).toEqual([[{ source: context, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("contracts alone retain the native source and selected profile", async () => {
  const services = createWorkflowDistributionFixture(), source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createSource = mock(), createAssets = mock(), createContracts = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContracts: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createSource, createAssets, createContracts });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createSource).not.toHaveBeenCalled();
  expect(createAssets).not.toHaveBeenCalled();
  expect(createContracts.mock.calls).toEqual([[{ source: services.source, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
test("all source preparations remain ordered within the same profile", async () => {
  const services = createWorkflowDistributionFixture(), context = { load: mock() }, assets = { load: mock() }, source = { load: mock() }, assemble = mock().mockResolvedValue(workflowBuildFailure), createSource = mock().mockReturnValue(context), createAssets = mock().mockReturnValue(assets), createContracts = mock().mockReturnValue(source);
  const selected = createPublicationAssembler({ request: { ...workflowBuildRequest, runtimeContext: "prepare-source", runtimeAssets: "prepare-authored", runtimeContracts: "prepare-source" }, assemble, createServices: mock().mockReturnValue(services), createSource, createAssets, createContracts });
  expect(await selected(input)).toEqual(workflowBuildFailure);
  expect(createAssets.mock.calls).toEqual([[{ source: context, mode: 0o644 }]]);
  expect(createContracts.mock.calls).toEqual([[{ source: assets, mode: 0o644 }]]);
  expect(assemble.mock.calls).toEqual([[{ ...input, services: { ...services, source } }]]);
});
