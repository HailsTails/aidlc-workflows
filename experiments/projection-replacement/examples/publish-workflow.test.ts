import { contextRuntimeEvidence, contextInputPreparation } from "../__tests__/distribution-context-fixtures.ts";
import { assetInputPreparation } from "../__tests__/runtime-asset-delivery-fixtures.ts";
import { expect, mock, test } from "bun:test";
import { publishInitialWorkflow, formatWorkflowPublication, createWorkflowPublicationServices } from "./publish-workflow.ts";
import { createWorkflowPublicationFixture, workflowBuildRequest, publishedWorkflow, workflowBuildFailure, directoryFailure } from "../__tests__/workflow-publication-fixtures.ts";
import { firstSnapshot, publicationPayload } from "../__tests__/publication-fixtures.ts";
test("the generic workflow factory refuses Core metadata rather than silently retaining it", async () => {
  const createAssembly = mock();
  const services = createWorkflowPublicationServices({ request: { ...workflowBuildRequest, distributionMetadata: "prepare-source" }, createAssembly });
  expect(await services.assemble({ location: { sourceRoot: "source", root: "runtime", basis: { source: { kind: "core", id: "framework" }, pin: workflowBuildRequest.sourcePin } }, binding: { harness: "claude", directory: ".claude" }, contextRoot: "private", mode: 0o644, modelInvocation: "native-default" })).toEqual({ status: "invalid", findings: [{ code: "capability-gap", subject: "workflow-publication", detail: "source distribution metadata is implemented by the Core publication profile only" }] });
  expect(createAssembly).not.toHaveBeenCalled();
});
test("workflow factory passes explicit context selection to its assembly factory", () => {
  const request = { ...workflowBuildRequest, runtimeContext: "prepare-source" } as const, assemble = mock(), createAssembly = mock().mockReturnValue(assemble);
  expect(createWorkflowPublicationServices({ request, createAssembly }).assemble).toBe(assemble);
  expect(createAssembly.mock.calls).toEqual([[{ request }]]);
});
test("an initial workflow publishes its native artifact and ownership together", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services })).toEqual({ status: "ok", value: publishedWorkflow });
  expect(services.repository.publish).toHaveBeenCalledWith({ expectedHead: null, artifactPair: publicationPayload });
  expect(services.assemble).toHaveBeenCalledWith({ location: { sourceRoot: "source", root: "runtime", basis: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" } }, binding: { harness: "claude", directory: ".claude" }, contextRoot: "private-root", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "native-supplied" });
  expect(services.directories.remove).toHaveBeenCalledWith({ root: "private-root" });
});
test("an existing publication is preserved before source work begins", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services: { ...services, repository: { ...services.repository, read: mock().mockResolvedValue({ status: "ok", value: firstSnapshot }) } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "workflow-publication", detail: "initial production requires an empty publication store; preserve this artifact and ownership pair and use owned reconciliation for updates" }] });
  expect(services.directories.allocate).not.toHaveBeenCalled();
  expect(services.assemble).not.toHaveBeenCalled();
  expect(services.repository.publish).not.toHaveBeenCalled();
});
test("an unavailable source capability releases context without publishing", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services: { ...services, assemble: mock().mockResolvedValue(workflowBuildFailure) } })).toEqual(workflowBuildFailure);
  expect(services.directories.remove).toHaveBeenCalledWith({ root: "private-root" });
  expect(services.repository.publish).not.toHaveBeenCalled();
});
test("a context cleanup failure cannot publish a built artifact", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services: { ...services, directories: { ...services.directories, remove: mock().mockResolvedValue(directoryFailure) } } })).toEqual(directoryFailure);
  expect(services.repository.publish).not.toHaveBeenCalled();
});
test("publication races remain failures after a successful build", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services: { ...services, repository: { ...services.repository, publish: mock().mockResolvedValue({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "publication head changed" }] }) } } })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "publication head changed" }] });
});
test("an invalid publication store stops before allocation", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: workflowBuildRequest, services: { ...services, repository: { ...services.repository, read: mock().mockResolvedValue(workflowBuildFailure) } } })).toEqual(workflowBuildFailure);
  expect(services.directories.allocate).not.toHaveBeenCalled();
});
test("the report distinguishes projected workflows from native runtime inputs", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"], preparedPaths: [], suppliedPaths: [".claude/tools/aidlc.ts", ".claude/tools/data/harness.json", ".claude/assets/opaque.bin"] });
  expect(JSON.parse(formatWorkflowPublication({ published: publishedWorkflow, publicationPath: "artifact.sqlite", describeSupply }))).toEqual({ reportVersion: 3, publicationPath: "artifact.sqlite", head: "ebaa4a347bd65cfc6f6b4d36c7827522771ea96803e49592dca2698cc6f517fa", revision: 1, archiveBytes: 3, binding: { harness: "claude", directory: ".claude" }, sourceBasis: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" }, compilerInputCount: 1, stageDocuments: { kind: "projected", projectedFiles: 1 }, methodRuntime: { kind: "native-supplied" }, workflowReferences: { kind: "native-supplied" }, projectedScopes: 1, projectedPaths: [".claude/skills/owned/SKILL.md"], sourceProjectedFiles: 1, sourceCompiledPaths: [".claude/tools/data/stage-graph.json", ".claude/tools/data/scope-grid.json"], sourceCompiledFiles: 2, sourcePreparedRuntimePaths: [], sourcePreparedRuntimeFiles: 0, suppliedRuntimeFiles: 3, retainedPreparedFiles: 5, runtimeAndConfiguration: "prepared-runtime-supplied", projectionScope: "core-workflow-selected-surfaces" });
  expect(describeSupply).toHaveBeenCalledWith({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [], preparedPaths: [], retainedPaths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] });
});
test("the report preserves explicit artifact directory construction independently of file modes", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, artifact: { ...publishedWorkflow.workflow.artifact, distribution: { ...publishedWorkflow.workflow.artifact.distribution, structure: { kind: "file-parents", mode: 0o755 } as const, directories: [{ path: ".claude", mode: 0o755 }, { path: ".claude/tools", mode: 0o755 }] } } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply })).directoryPreparation).toEqual({ kind: "file-parents", mode: 493, directories: 2 });
});
test("prepared method provenance is forwarded to the file-supply classifier and report", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [".claude/tools/data/memory-seed/org.md"], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, methodRuntime: { kind: "prepared" as const, paths: [".claude/tools/data/memory-seed/org.md"], inputs: [{ path: "core/memory/org.md", sha256: "raw-source-digest" }] } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply }))).toMatchObject({ reportVersion: 3, methodRuntime: { kind: "prepared", paths: [".claude/tools/data/memory-seed/org.md"], inputs: [{ path: "core/memory/org.md", sha256: "raw-source-digest" }] }, sourcePreparedRuntimePaths: [".claude/tools/data/memory-seed/org.md"], sourcePreparedRuntimeFiles: 1 });
  expect(describeSupply).toHaveBeenCalledWith({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [], preparedPaths: [".claude/tools/data/memory-seed/org.md"], retainedPaths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] });
});

test("Core report retains combined source witnesses with its own explicit scope", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, artifact: { ...publishedWorkflow.workflow.artifact, sourceInputs: [{ path: "core/tools/aidlc-tiers.ts", sha256: "raw-tier-digest" }] } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply, scope: "core-authored-selected-surfaces" }))).toMatchObject({ sourceInputs: [{ path: "core/tools/aidlc-tiers.ts", sha256: "raw-tier-digest" }], projectionScope: "core-authored-selected-surfaces" });
});

test("compiled workflow references are prepared runtime data without increasing projection ownership", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [".claude/skills/aidlc/tables.md"], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, workflowReferences: { kind: "prepared" as const, paths: [".claude/skills/aidlc/tables.md"], inputs: [{ path: "harness/claude/skills/aidlc/tables.md", sha256: "raw-table-template" }] } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply }))).toMatchObject({ reportVersion: 3, sourcePreparedRuntimeFiles: 1, workflowReferences: { kind: "prepared", paths: [".claude/skills/aidlc/tables.md"], inputs: [{ path: "harness/claude/skills/aidlc/tables.md", sha256: "raw-table-template" }] } });
  expect(describeSupply).toHaveBeenCalledWith({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [], preparedPaths: [".claude/skills/aidlc/tables.md"], retainedPaths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] });
});

test("explicit compiled references reach the publication assembler without a retained-mode override", async () => {
  const services = createWorkflowPublicationFixture();
  expect(await publishInitialWorkflow({ request: { ...workflowBuildRequest, workflowReferences: "prepare-compiled" }, services })).toEqual({ status: "ok", value: publishedWorkflow });
  expect(services.assemble).toHaveBeenCalledWith({ location: { sourceRoot: "source", root: "runtime", basis: { source: { kind: "core", id: "framework" }, pin: "d062c81e5678c9f92162542b425b8a5f095e46e1" } }, binding: { harness: "claude", directory: ".claude" }, contextRoot: "private-root", mode: 0o644, modelInvocation: "native-default", stageDocuments: "project-authored", methodRuntime: "prepare-authored", workflowReferences: "prepare-compiled" });
});

test("source context files join prepared runtime counts independently of method and graph outputs", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [".claude/tools/data/harness.json"], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, artifact: { ...publishedWorkflow.workflow.artifact, inputPreparations: [contextInputPreparation] } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply }))).toMatchObject({ runtimeContext: contextRuntimeEvidence, inputPreparations: [contextInputPreparation], sourcePreparedRuntimeFiles: 1 });
  expect(describeSupply).toHaveBeenCalledWith({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [], preparedPaths: [".claude/tools/data/harness.json"], retainedPaths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] });
});
test("asset preparation contributes provenance and prepared counts without pretending to be context", () => {
  const describeSupply = mock().mockReturnValue({ projectedPaths: [], compiledPaths: [], preparedPaths: [".claude/tools/data/model-rates.json"], suppliedPaths: [] });
  const published = { ...publishedWorkflow, workflow: { ...publishedWorkflow.workflow, artifact: { ...publishedWorkflow.workflow.artifact, inputPreparations: [assetInputPreparation] } } };
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply }))).toMatchObject({ inputPreparations: [assetInputPreparation], sourcePreparedRuntimeFiles: 1 });
  expect(JSON.parse(formatWorkflowPublication({ published, publicationPath: "artifact.sqlite", describeSupply }))).not.toHaveProperty("runtimeContext");
  expect(describeSupply).toHaveBeenCalledWith({ projectedPaths: [".claude/skills/owned/SKILL.md"], compiledPaths: [], preparedPaths: [".claude/tools/data/model-rates.json"], retainedPaths: [".claude/tools/data/aidlc-projection.json", ".claude/tools/data/aidlc-stamp.json", ".claude/tools/data/harness.json", ".claude/skills/aidlc-session-cost/SKILL.md", ".claude/assets/opaque.bin"] });
});
