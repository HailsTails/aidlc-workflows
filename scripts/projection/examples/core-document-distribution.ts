import { collectRuntimeInputEvidence } from "../src/domain/runtime-inputs.ts";
import { createPreparedRuntimeAssembler, type PreparedRuntimeAssembly, type WorkflowDistributionServices } from "./workflow-distribution.ts";
import { completeProjectionDistribution, type ProjectionDistributionRequest } from "./projection-distribution.ts";
import { describeDistribution, type DescriptionServices } from "../src/application/describe-distribution.ts";
import { prepareCoreAuthoredDocuments } from "./core-authored-documents.ts";
import { combineProjectionSets } from "../src/application/combine-projections.ts";
import { mergeSourceDigests } from "../src/domain/source-origin.ts";
import { planPreparedFileAdditions } from "../src/domain/prepared-file-additions.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { createDistributionWorkspace, type DistributionWorkspace } from "../src/adapters/distribution-workspace.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import type { DistributionAssemblyRules } from "../src/application/distribution-assembly.ts";
import type { WorkflowAuthoringPolicy } from "../src/domain/workflow-prose.ts";
import type { CoreAuthoredDocuments } from "./core-authored-documents.ts";
import type { IssuedProjectionDistribution } from "./projection-distribution.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type CoreDocumentDistributionServices = { readonly describe: typeof describeDistribution; readonly description?: DescriptionServices; readonly documents: typeof prepareCoreAuthoredDocuments; readonly combine: typeof combineProjectionSets; readonly digests: typeof mergeSourceDigests; readonly admit: typeof planPreparedFileAdditions; readonly finish: typeof completeProjectionDistribution; readonly assembler: typeof createPreparedRuntimeAssembler; readonly workspace: DistributionWorkspace; readonly rules: DistributionAssemblyRules };
export const createCoreDocumentDistributionServices = (): CoreDocumentDistributionServices => ({ describe: describeDistribution, documents: prepareCoreAuthoredDocuments, combine: combineProjectionSets, digests: mergeSourceDigests, admit: planPreparedFileAdditions, finish: completeProjectionDistribution, assembler: createPreparedRuntimeAssembler, workspace: createDistributionWorkspace(), rules: createDistributionAssemblyRules() });
type DescriptionSelection = { readonly kind: "supplied" } | { readonly kind: "prepare"; readonly root: string; readonly description: DescriptionServices };
const selectCoreDescription = ({ description, workRoot }: { readonly description: DescriptionServices | undefined; readonly workRoot: string | undefined }): Outcome<DescriptionSelection> => {
  if (description === undefined) return { status: "ok", value: { kind: "supplied" } };
  if (workRoot === undefined || workRoot.trim().length === 0) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "distribution-description", detail: "Core description finalization requires the existing private runtime workspace" })] };
  return { status: "ok", value: { kind: "prepare", root: workRoot, description } };
};
const completeCoreDescription = ({ request, selection, services }: { readonly request: ProjectionDistributionRequest; readonly selection: DescriptionSelection; readonly services: Pick<CoreDocumentDistributionServices, "describe" | "finish"> }): Promise<Outcome<IssuedProjectionDistribution>> => selection.kind === "supplied" ? services.finish(request) : continuePreparation({ previous: services.describe({ request: { ...request, root: selection.root }, services: selection.description }), consume: ({ prepared: seed }) => services.finish({ ...request, seed }) });
const finishCoreDescription = ({ request, workRoot, services }: { readonly request: ProjectionDistributionRequest; readonly workRoot: string | undefined; readonly services: Pick<CoreDocumentDistributionServices, "describe" | "description" | "finish"> }): Promise<Outcome<IssuedProjectionDistribution>> => continuePreparation({ previous: selectCoreDescription({ description: services.description, workRoot }), consume: ({ prepared: selection }) => completeCoreDescription({ request, selection, services }) });
export const createCoreProjectionCompletion = ({ documents, workRoot, services = { describe: describeDistribution, combine: combineProjectionSets, finish: completeProjectionDistribution } }: { readonly documents: CoreAuthoredDocuments; readonly workRoot?: string; readonly services?: Pick<CoreDocumentDistributionServices, "describe" | "combine" | "finish" | "description"> }): typeof completeProjectionDistribution => ({ projection, ...request }) => continuePreparation({ previous: services.combine({ target: projection.target, sets: [projection, documents.projection] }), consume: ({ prepared }) => finishCoreDescription({ request: { ...request, projection: prepared }, workRoot, services }) });
const coreSourceInputGroups = ({ request, documents }: { readonly request: PreparedRuntimeAssembly; readonly documents: CoreAuthoredDocuments }) => [request.workflow.inputs, request.authoring?.inputs ?? [], request.methodRuntime.kind === "prepared" ? request.methodRuntime.inputs : [], request.workflowReferences.kind === "prepared" ? request.workflowReferences.inputs : [], collectRuntimeInputEvidence({ preparations: request.seed.inputPreparations ?? [] }).inputs, documents.inputs];
type AuthoredCorePreparation = PreparedRuntimeAssembly & { readonly authoring: WorkflowAuthoringPolicy };
const admitCorePreparationContext = ({ request }: { readonly request: PreparedRuntimeAssembly }): Outcome<AuthoredCorePreparation> => request.authoring === null || request.methodRuntime.kind !== "prepared"
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "authored-core", detail: "the authored Core profile requires freshly prepared stage authoring and method runtime context" })] }
  : { status: "ok", value: { ...request, authoring: request.authoring } };
const coreDocumentPreparationRequest = ({ request }: { readonly request: AuthoredCorePreparation }) => ({ sourceRoot: request.location.sourceRoot, workRoot: request.location.root, basis: request.seed.basis, context: { ...request.seed.binding, invocation: request.seed.invocation, rulesSubdir: request.seed.rulesSubdir, optionLetters: request.authoring.optionLetters }, workflow: request.workflow, mode: request.mode });
const assembleCoreDocumentRuntime = async ({ request, documents, services }: { readonly request: PreparedRuntimeAssembly; readonly documents: CoreAuthoredDocuments; readonly services: CoreDocumentDistributionServices }): Promise<Outcome<IssuedProjectionDistribution>> => {
  const inputs = services.digests({ groups: coreSourceInputGroups({ request, documents }) });
  if (inputs.status === "invalid") return inputs;
  const admitted = services.admit({ candidates: documents.projection.resources, inventory: request.seed, mode: request.mode, rules: services.rules });
  if (admitted.status === "invalid") return admitted;
  const seed = { ...request.seed, files: [...request.seed.files, ...admitted.value.additions] };
  const assembler = services.assembler({ finish: createCoreProjectionCompletion({ documents, services, workRoot: request.location.root }) });
  const artifact = await services.workspace.run({ sourceRoot: request.location.sourceRoot, seed, consume: ({ root }) => assembler({ ...request, seed, location: { ...request.location, root } }) });
  if (artifact.status === "invalid") return artifact;
  const finalInputs = services.digests({ groups: [inputs.value, collectRuntimeInputEvidence({ preparations: artifact.value.inputPreparations ?? [] }).inputs] });
  return finalInputs.status === "invalid" ? finalInputs : { status: "ok", value: { ...artifact.value, sourceInputs: finalInputs.value } };
};
export const assembleCoreDocumentDistribution = async ({ services = createCoreDocumentDistributionServices(), ...request }: PreparedRuntimeAssembly & { readonly services?: CoreDocumentDistributionServices }): Promise<Outcome<IssuedProjectionDistribution>> => {
  const admitted = admitCorePreparationContext({ request });
  if (admitted.status === "invalid") return admitted;
  const documents = await services.documents(coreDocumentPreparationRequest({ request: admitted.value }));
  return documents.status === "invalid" ? documents : assembleCoreDocumentRuntime({ request, documents: documents.value, services });
};
export const createAuthoredCoreAssembler = (): WorkflowDistributionServices["assemble"] => assembleCoreDocumentDistribution;
