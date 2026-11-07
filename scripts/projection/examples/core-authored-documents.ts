import { qualifiedDeliveryContext, qualifiedHarnessProfile } from "../src/adapters/qualified-harness-profile.ts";
import { prepareCoreSensorProducts } from "./core-sensor-products.ts";
import { prepareCoreSkillProducts } from "./core-skill-products.ts";
import { prepareCoreKnowledgeProducts } from "./core-knowledge-products.ts";
import { prepareCoreAgentProducts } from "./core-agent-products.ts";
import { prepareCoreGuidanceProducts } from "./core-guidance-products.ts";
import { prepareOnboardingProducts } from "./onboarding-products.ts";
import { prepareHarnessDocumentProducts } from "./harness-document-products.ts";
import { createCoreAgentPolicyReader, type CoreAgentPolicyReader } from "../src/adapters/core-agent-policy.ts";
import { parseCompiledAgentStages } from "../src/adapters/compiled-agent-stages.ts";
import { combineProjectionSets } from "../src/application/combine-projections.ts";
import type { ProjectionSet } from "../src/application/projection-set.ts";
import type { CompiledWorkflowSource } from "../src/domain/workflow-compilation.ts";
import type { CompiledAgentStageCatalogue } from "../src/domain/compiled-agent-stages.ts";
import type { PreparedCoreAgentPolicy } from "../src/domain/core-agent-policy.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import { mergeSourceDigests, type SourceBasis, type SourceContentDigest } from "../src/domain/source-origin.ts";
import { copyHarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, type Outcome } from "../src/domain/model.ts";
export type CoreAuthoredDocuments = { readonly projection: ProjectionSet; readonly inputs: readonly SourceContentDigest[] };
export type CoreDocumentServices = { readonly policy: CoreAgentPolicyReader; readonly catalogue: typeof parseCompiledAgentStages; readonly sensors: typeof prepareCoreSensorProducts; readonly skills: typeof prepareCoreSkillProducts; readonly knowledge: typeof prepareCoreKnowledgeProducts; readonly agents: typeof prepareCoreAgentProducts; readonly guidance: typeof prepareCoreGuidanceProducts; readonly entries: typeof prepareHarnessDocumentProducts; readonly onboarding: typeof prepareOnboardingProducts; readonly combine: typeof combineProjectionSets; readonly digests: typeof mergeSourceDigests };
export const createCoreDocumentServices = (): CoreDocumentServices => ({ policy: createCoreAgentPolicyReader(), catalogue: parseCompiledAgentStages, sensors: prepareCoreSensorProducts, skills: prepareCoreSkillProducts, knowledge: prepareCoreKnowledgeProducts, agents: prepareCoreAgentProducts, guidance: prepareCoreGuidanceProducts, entries: prepareHarnessDocumentProducts, onboarding: prepareOnboardingProducts, combine: combineProjectionSets, digests: mergeSourceDigests });
const retainAgentPolicyOrigins = ({ projection, policy }: { readonly projection: ProjectionSet; readonly policy: PreparedCoreAgentPolicy }): ProjectionSet => ({ ...projection, units: projection.units.map((unit) => unit.kind === "compiled-agent" || unit.kind === "agent" ? { ...unit, projection: { ...unit.projection, dependencies: [...(unit.projection.dependencies ?? []), ...policy.origins] } } : unit) });
export type CoreDocumentRequest = { readonly sourceRoot: string; readonly workRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly workflow: CompiledWorkflowSource; readonly mode: number };
const admitCoreDocumentProfile = ({ request }: { readonly request: CoreDocumentRequest }): Outcome<CoreDocumentRequest> => !qualifiedDeliveryContext(request.context)
  ? { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-authored-documents", detail: "the authored Core document profile qualifies the declared host copy and native delivery; no other harness policy is inferred" })] }
  : { status: "ok", value: request };
const collectDocumentPreparations = ({ prepared }: { readonly prepared: readonly Outcome<CoreAuthoredDocuments>[] }): Outcome<readonly CoreAuthoredDocuments[]> => {
  const failures = prepared.flatMap((document) => document.status === "invalid" ? document.findings : []);
  return failures.length > 0 ? { status: "invalid", findings: failures } : { status: "ok", value: prepared.flatMap((document) => document.status === "ok" ? [document.value] : []) };
};
const retainPreparedAgentPolicy = ({ prepared, policy }: { readonly prepared: Outcome<CoreAuthoredDocuments>; readonly policy: PreparedCoreAgentPolicy }): Outcome<CoreAuthoredDocuments> => prepared.status === "invalid" ? prepared : { status: "ok", value: { ...prepared.value, projection: retainAgentPolicyOrigins({ projection: prepared.value.projection, policy }) } };
const collectCoreDocuments = ({ prepared, context, policy, services }: { readonly prepared: readonly Outcome<CoreAuthoredDocuments>[]; readonly context: AuthoredProseContext; readonly policy: PreparedCoreAgentPolicy; readonly services: CoreDocumentServices }): Outcome<CoreAuthoredDocuments> => {
  const documents = collectDocumentPreparations({ prepared });
  if (documents.status === "invalid") return documents;
  const inputs = services.digests({ groups: [policy.inputs, ...documents.value.map((document) => document.inputs)] });
  if (inputs.status === "invalid") return inputs;
  const projection = services.combine({ target: copyHarnessBinding({ binding: context }), sets: documents.value.map((document) => document.projection) });
  return projection.status === "invalid" ? projection : { status: "ok", value: { projection: projection.value, inputs: inputs.value } };
};
const prepareDocumentOwners = async ({ request, policy, catalogue, services }: { readonly request: CoreDocumentRequest; readonly policy: PreparedCoreAgentPolicy; readonly catalogue: CompiledAgentStageCatalogue; readonly services: CoreDocumentServices }): Promise<Outcome<CoreAuthoredDocuments>> => {
  const preparationLocation = { sourceRoot: request.sourceRoot, basis: request.basis, mode: request.mode };
  const [skills, knowledge, agents, guidance, entries, onboarding, sensors] = await Promise.all([
    services.skills({ ...preparationLocation, context: { ...request.context, memoryRoot: "aidlc/active-memory", modelInvocation: qualifiedHarnessProfile(request.context)!.modelInvocation } }),
    services.knowledge({ ...preparationLocation, context: request.context }),
    services.agents({ ...preparationLocation, context: { ...request.context, tierCap: policy.tierCap, models: policy.models, sharedKnowledge: "methodology-only", knowledgeRead: "ordinary", memoryReference: qualifiedHarnessProfile(request.context)!.agentMemoryReference, ...(qualifiedHarnessProfile(request.context)!.agentTurnLimit === null ? {} : { turnLimitProjection: qualifiedHarnessProfile(request.context)!.agentTurnLimit! }) }, catalogue }),
    services.guidance({ ...preparationLocation, context: request.context }),
    services.entries({ ...preparationLocation, context: request.context }),
    services.onboarding({ ...preparationLocation, workRoot: request.workRoot, context: request.context }),
    services.sensors({ ...preparationLocation, context: request.context }),
  ]);
  const preparedAgents = retainPreparedAgentPolicy({ prepared: agents, policy });
  return collectCoreDocuments({ prepared: [skills, knowledge, preparedAgents, guidance, entries, onboarding, sensors], context: request.context, policy, services });
};
export const prepareCoreAuthoredDocuments = async ({ services = createCoreDocumentServices(), ...request }: CoreDocumentRequest & { readonly services?: CoreDocumentServices }): Promise<Outcome<CoreAuthoredDocuments>> => {
  const admitted = admitCoreDocumentProfile({ request });
  if (admitted.status === "invalid") return admitted;
  const policy = await services.policy.load({ sourceRoot: request.sourceRoot, basis: request.basis, binding: copyHarnessBinding({ binding: request.context }) });
  if (policy.status === "invalid") return policy;
  const catalogue = services.catalogue({ text: request.workflow.graph.text, artifact: request.workflow.graph.origin, binding: copyHarnessBinding({ binding: request.context }), sources: [request.basis] });
  return catalogue.status === "invalid" ? catalogue : prepareDocumentOwners({ request, policy: policy.value, catalogue: catalogue.value, services });
};
