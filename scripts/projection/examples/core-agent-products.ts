import { qualifiedDeliveryContext, qualifiedHarnessProfile } from "../src/adapters/qualified-harness-profile.ts";
import { prepareNativeProjectionCommands } from "../src/adapters/native-document-preparation.ts";
import { createCoreAgentSourceReader, type CoreAgentSourceReader } from "../src/adapters/core-agent-sources.ts";
import { createCoreKnowledgeSourceReader, type CoreKnowledgeSourceReader } from "../src/adapters/core-knowledge-sources.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { CoreAgentSources } from "../src/domain/core-agent-sources.ts";
import type { CoreKnowledgeSources } from "../src/domain/core-knowledge-sources.ts";
import type { AgentContext } from "../src/domain/agent-definition.ts";
import type { CompiledAgentStageCatalogue } from "../src/domain/compiled-agent-stages.ts";
import type { SourceBasis, SourceContentDigest } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { copyHarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";
export type CoreAgentInputs = { readonly agents: CoreAgentSources; readonly knowledge: CoreKnowledgeSources };
export type CoreAgentProducts = { readonly projection: ProjectionSet; readonly inputs: readonly SourceContentDigest[]; readonly products: readonly DistributionProduct[] };
export const selectCoreAgentProducts = ({ sources, basis, context, catalogue }: { readonly sources: CoreAgentInputs; readonly basis: SourceBasis; readonly context: AgentContext; readonly catalogue: CompiledAgentStageCatalogue }): Outcome<ProjectionSetRequest> => {
  if (!qualifiedDeliveryContext(context)) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-products", detail: "this core agent producer qualifies the declared host copy and native definitions; other host policies require separate verified preparation" })] };
  if ((context.turnLimitProjection ?? null) !== qualifiedHarnessProfile(context)?.agentTurnLimit) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-agent-products", detail: "agent turn-limit interpretation must match the qualified source profile" })] };
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || sources.agents.agents.length === 0 || [...sources.agents.agents, ...sources.knowledge.documents].some((entry) => sourceKey(entry.origin.source) !== sourceKey(basis.source) || entry.origin.pin !== basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-agent-products", detail: "agents and knowledge must preserve the framework source basis" })] };
  if (sourceKey(catalogue.artifact.source) !== sourceKey(basis.source) || catalogue.artifact.pin !== basis.pin || catalogue.artifact.path !== `${context.directory}/tools/data/stage-graph.json`) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-agent-products", detail: "compiled participation must bind the current framework artifact and selected harness" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: context }), units: sources.agents.agents.map((agent) => ({ kind: "compiled-agent", key: `agent-${agent.name}`, input: { agent, context, catalogue, footprint: "definition", knowledge: sources.knowledge.documents.filter((entry) => entry.origin.path.startsWith(`core/knowledge/${agent.name}/`)).map((entry) => ({ origin: entry.origin, body: entry.text })) } })) } };
};
export type CoreAgentProductServices = { readonly agents: CoreAgentSourceReader; readonly knowledge: CoreKnowledgeSourceReader; readonly select: typeof selectCoreAgentProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
export const createCoreAgentProductServices = (): CoreAgentProductServices => ({ agents: createCoreAgentSourceReader(), knowledge: createCoreKnowledgeSourceReader(), select: selectCoreAgentProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
const readCoreAgentInputs = async ({ sourceRoot, basis, services }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly services: CoreAgentProductServices }): Promise<Outcome<CoreAgentInputs>> => {
  const [agents, knowledge] = await Promise.all([services.agents.load({ sourceRoot, basis }), services.knowledge.load({ sourceRoot, basis })]);
  return agents.status === "invalid" ? agents : knowledge.status === "invalid" ? knowledge : { status: "ok", value: { agents: agents.value, knowledge: knowledge.value } };
};
export const prepareCoreAgentProducts = ({ sourceRoot, basis, context, catalogue, mode, services = createCoreAgentProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AgentContext; readonly catalogue: CompiledAgentStageCatalogue; readonly mode: number; readonly services?: CoreAgentProductServices }): Promise<Outcome<CoreAgentProducts>> => continuePreparation({
  previous: readCoreAgentInputs({ sourceRoot, basis, services }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.select({ sources, basis, context, catalogue }), consume: async ({ prepared: selection }) => continuePreparation({
      previous: services.project(selection), consume: async ({ prepared: rendered }) => continuePreparation({
        previous: prepareNativeProjectionCommands({ projection: rendered, sourceRoot, basis, context }), consume: async ({ prepared: commands }) => continuePreparation({
        previous: services.products({ projection: commands.projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection: commands.projection, inputs: [...sources.agents.inputs, ...sources.knowledge.inputs, ...commands.inputs], products } }),
        }),
      }),
    }),
  }),
});
