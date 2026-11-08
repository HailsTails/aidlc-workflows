import type { DistributionDirectoryFactory } from "../src/adapters/distribution-directory.ts";
import { createWorkflowSourceCompiler } from "../src/adapters/workflow-source-compiler.ts";
import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import { createDistributionSource, createDistributionAssemblyRules, type DistributionSource, type DistributionSourceLocation } from "../src/adapters/distribution-source.ts";
import { createDistributionWorkspace, type DistributionWorkspace } from "../src/adapters/distribution-workspace.ts";
import { prepareWorkflowRuntime, type WorkflowRuntime } from "../src/domain/workflow-runtime.ts";
import { assembleRunnerDistribution, type IssuedRunnerDistribution } from "./runner-distribution.ts";
import type { WorkflowSourceCompiler, CompiledWorkflowSource } from "../src/domain/workflow-compilation.ts";
import type { GeneratedRunnerContext } from "../src/domain/generated-runner.ts";
import type { HarnessBinding } from "../src/domain/harness-binding.ts";
import type { DistributionAssemblyRules } from "../src/application/distribution-assembly.ts";
import type { Outcome } from "../src/domain/model.ts";
import { createPreparedDistributionSource, type PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import { createRunnerDistributionServices } from "./runner-distribution.ts";
import { completeProjectionDistribution } from "./projection-distribution.ts";
import type { DistributionSeed, AssembledDistribution } from "../src/domain/distribution-artifact.ts";
import { prepareAuthoredScopes } from "./scope-runtime.ts";
import { createStageRuntimeServices, prepareAuthoredStages } from "./stage-runtime.ts";
import { mergeWorkflowDefinitions } from "../src/application/workflow-definitions.ts";
import { createMethodRuntimeServices, prepareAuthoredMethodRuntime, type MethodRuntimePreparation } from "./method-runtime.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import type { WorkflowAuthoringPolicy } from "../src/domain/workflow-prose.ts";
import { createWorkflowReferenceRuntimeServices, prepareCompiledWorkflowReferenceRuntime, type WorkflowReferencePreparation } from "./workflow-reference-runtime.ts";
export type PreparedRuntimeAssembly = { readonly seed: DistributionSeed; readonly definitions: ProjectionSet; readonly location: DistributionSourceLocation; readonly mode: number; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"]; readonly workflow: CompiledWorkflowSource; readonly authoring: WorkflowAuthoringPolicy | null; readonly methodRuntime: MethodRuntimePreparation; readonly workflowReferences: WorkflowReferencePreparation };
export type WorkflowDistributionServices = { readonly source: PreparedDistributionSource; readonly methods: typeof prepareAuthoredMethodRuntime; readonly references: typeof prepareCompiledWorkflowReferenceRuntime; readonly compiler: WorkflowSourceCompiler; readonly scopes: typeof prepareAuthoredScopes; readonly stages: typeof prepareAuthoredStages; readonly merge: typeof mergeWorkflowDefinitions; readonly prepare: typeof prepareWorkflowRuntime; readonly workspace: DistributionWorkspace; readonly assemble: (input: PreparedRuntimeAssembly) => Promise<Outcome<IssuedRunnerDistribution>>; readonly rules: DistributionAssemblyRules };
export type StageDocumentPreparation = { readonly kind: "projected"; readonly projection: ProjectionSet; readonly authoring: WorkflowAuthoringPolicy; readonly commands: import("../src/domain/native-stage-commands.ts").NativeStageCommands | null } | { readonly kind: "native-supplied" };
export type WorkflowDistribution = { readonly artifact: IssuedRunnerDistribution; readonly workflow: CompiledWorkflowSource; readonly scopes: ProjectionSet; readonly stageDocuments: StageDocumentPreparation; readonly methodRuntime: MethodRuntimePreparation; readonly workflowReferences: WorkflowReferencePreparation; readonly preparation: Omit<WorkflowRuntime, "seed"> };
type SelectedMethodRuntime = { readonly seed: DistributionSeed; readonly preparation: MethodRuntimePreparation };
const selectMethodRuntime = ({ selection, sourceRoot, seed, mode, services }: { readonly selection: "prepare-authored" | "native-supplied"; readonly sourceRoot: string; readonly seed: DistributionSeed; readonly mode: number; readonly services: WorkflowDistributionServices }): Promise<Outcome<SelectedMethodRuntime>> => selection === "native-supplied" ? Promise.resolve({ status: "ok", value: { seed, preparation: { kind: "native-supplied" } } }) : services.methods({ sourceRoot, seed, mode });
type SelectedStageDocuments = { readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly preparation: StageDocumentPreparation };
const selectStageDocuments = async ({ selection, sourceRoot, seed, workflow, mode, services }: { readonly selection: "project-authored" | "native-supplied"; readonly sourceRoot: string; readonly seed: DistributionSeed; readonly workflow: CompiledWorkflowSource; readonly mode: number; readonly services: WorkflowDistributionServices }): Promise<Outcome<SelectedStageDocuments>> => {
  if (selection === "native-supplied") return { status: "ok", value: { seed, projection: { scope: "selected-surfaces", target: seed.binding, units: [], resources: [] }, preparation: { kind: "native-supplied" } } };
  const projected = await services.stages({ sourceRoot, seed, workflow, mode });
  return projected.status === "invalid" ? projected : { status: "ok", value: { seed: projected.value.seed, projection: projected.value.projection, preparation: { kind: "projected", projection: projected.value.projection, authoring: projected.value.authoring, commands: projected.value.commands } } };
};
const stageAuthoringPolicy = ({ preparation }: { readonly preparation: StageDocumentPreparation }): WorkflowAuthoringPolicy | null => preparation.kind === "projected" ? preparation.authoring : null;
type SelectedWorkflowReferences = { readonly seed: DistributionSeed; readonly preparation: WorkflowReferencePreparation };
const selectWorkflowReferences = ({ selection, sourceRoot, seed, workflow, scopes, stages, mode, services }: { readonly selection: "native-supplied" | "prepare-compiled"; readonly sourceRoot: string; readonly seed: DistributionSeed; readonly workflow: CompiledWorkflowSource; readonly scopes: ProjectionSet; readonly stages: StageDocumentPreparation; readonly mode: number; readonly services: WorkflowDistributionServices }): Promise<Outcome<SelectedWorkflowReferences>> => selection === "native-supplied" ? Promise.resolve({ status: "ok", value: { seed, preparation: { kind: "native-supplied" } } }) : services.references({ sourceRoot, seed, workflow, scopeFiles: scopes.resources, authoring: stageAuthoringPolicy({ preparation: stages }), mode });
const validateAndArchive = ({ source, workspace, location, seed, distribution }: { readonly source: DistributionSource; readonly workspace: DistributionWorkspace; readonly location: DistributionSourceLocation; readonly seed: DistributionSeed; readonly distribution: Pick<AssembledDistribution, "files" | "directories"> }): Promise<Outcome<Uint8Array>> => workspace.run({ sourceRoot: location.sourceRoot, seed: { ...seed, files: distribution.files, directories: distribution.directories }, consume: async ({ root }) => {
  const validated = await source.load({ ...location, root });
  return validated.status === "invalid" ? validated : source.archive({ sourceRoot: location.sourceRoot, distribution });
} });
export const createPreparedRuntimeAssembler = ({ finish = completeProjectionDistribution, processes = createNativeCompilerProcessOperations, directories }: { readonly finish?: typeof completeProjectionDistribution; readonly processes?: NativeCompilerProcessFactory; readonly directories?: DistributionDirectoryFactory | undefined } = {}): WorkflowDistributionServices["assemble"] => {
  const services = createRunnerDistributionServices({ processes }), source = createDistributionSource(), workspace = createDistributionWorkspace({ directories });
  return ({ seed, definitions, location, mode, modelInvocation }) => assembleRunnerDistribution({ location, definitions, mode, modelInvocation, services: { ...services, finish, source: { load: async () => ({ status: "ok", value: seed }), archive: ({ distribution }) => validateAndArchive({ source, workspace, location, seed, distribution }) } } });
};
export const createWorkflowDistributionServices = ({ processes = createNativeCompilerProcessOperations, directories }: { readonly processes?: NativeCompilerProcessFactory; readonly directories?: DistributionDirectoryFactory | undefined } = {}): WorkflowDistributionServices => ({
  source: createPreparedDistributionSource(),
  methods: input => prepareAuthoredMethodRuntime({ ...input, services: input.services ?? createMethodRuntimeServices({ processes }) }),
  references: input => prepareCompiledWorkflowReferenceRuntime({ ...input, services: input.services ?? createWorkflowReferenceRuntimeServices({ processes, directories }) }),
  compiler: createWorkflowSourceCompiler({ processes }), scopes: prepareAuthoredScopes,
  stages: input => prepareAuthoredStages({ ...input, services: input.services ?? createStageRuntimeServices({ processes }) }),
  merge: mergeWorkflowDefinitions, prepare: prepareWorkflowRuntime, workspace: createDistributionWorkspace({ directories }), assemble: createPreparedRuntimeAssembler({ processes, directories }), rules: createDistributionAssemblyRules(),
});
export const assembleWorkflowDistribution = async ({ location, binding, contextRoot, mode, modelInvocation, stageDocuments = "native-supplied", methodRuntime = "native-supplied", workflowReferences = "native-supplied", services = createWorkflowDistributionServices() }: { readonly location: DistributionSourceLocation; readonly binding: HarnessBinding; readonly contextRoot: string; readonly mode: number; readonly modelInvocation: GeneratedRunnerContext["modelInvocation"]; readonly stageDocuments?: "project-authored" | "native-supplied"; readonly methodRuntime?: "prepare-authored" | "native-supplied"; readonly workflowReferences?: "native-supplied" | "prepare-compiled"; readonly services?: WorkflowDistributionServices }): Promise<Outcome<WorkflowDistribution>> => {
  const source = await services.source.load({ location, binding });
  if (source.status === "invalid") return source;
  const methods = await selectMethodRuntime({ selection: methodRuntime, sourceRoot: location.sourceRoot, seed: source.value, mode, services });
  if (methods.status === "invalid") return methods;
  const compiled = services.compiler.compile({ location: { sourceRoot: location.sourceRoot, contextRoot, basis: location.basis, binding } });
  if (compiled.status === "invalid") return compiled;
  const scopes = await services.scopes({ sourceRoot: location.sourceRoot, seed: methods.value.seed, workflow: compiled.value, mode });
  if (scopes.status === "invalid") return scopes;
  const stages = await selectStageDocuments({ selection: stageDocuments, sourceRoot: location.sourceRoot, seed: scopes.value.seed, workflow: compiled.value, mode, services });
  if (stages.status === "invalid") return stages;
  const definitions = services.merge({ first: scopes.value.projection, second: stages.value.projection });
  if (definitions.status === "invalid") return definitions;
  const prepared = services.prepare({ seed: stages.value.seed, workflow: compiled.value, mode, rules: services.rules });
  if (prepared.status === "invalid") return prepared;
  const references = await selectWorkflowReferences({ selection: workflowReferences, sourceRoot: location.sourceRoot, seed: prepared.value.seed, workflow: compiled.value, scopes: scopes.value.projection, stages: stages.value.preparation, mode, services });
  if (references.status === "invalid") return references;
  const assembled = await services.workspace.run({ sourceRoot: location.sourceRoot, seed: references.value.seed, consume: ({ root }) => services.assemble({ seed: references.value.seed, definitions: definitions.value, location: { ...location, root }, mode, modelInvocation, workflow: compiled.value, authoring: stageAuthoringPolicy({ preparation: stages.value.preparation }), methodRuntime: methods.value.preparation, workflowReferences: references.value.preparation }) });
  return assembled.status === "invalid" ? assembled : { status: "ok", value: { artifact: assembled.value, workflow: compiled.value, scopes: scopes.value.projection, stageDocuments: stages.value.preparation, methodRuntime: methods.value.preparation, workflowReferences: references.value.preparation, preparation: { compiledPaths: prepared.value.compiledPaths, addedPaths: prepared.value.addedPaths } } };
};
