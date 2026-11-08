import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import { isNativeDocumentContext, prepareNativeProjectionCommands } from "../src/adapters/native-document-preparation.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import { createCoreKnowledgeSourceReader, type CoreKnowledgeSourceReader } from "../src/adapters/core-knowledge-sources.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { CoreKnowledgeSources } from "../src/domain/core-knowledge-sources.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { copyHarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";
export type CoreKnowledgeProducts = { readonly projection: ProjectionSet; readonly inputs: CoreKnowledgeSources["inputs"]; readonly products: readonly DistributionProduct[] };
export type CoreKnowledgeProductServices = { readonly commands?: typeof prepareNativeProjectionCommands; readonly reader: CoreKnowledgeSourceReader; readonly select: typeof selectCoreKnowledgeProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
const knowledgeUnitKey = ({ relativePath }: { readonly relativePath: string }): string => `knowledge-${relativePath.indexOf("/")}-${relativePath.replaceAll("/", "-").replace(/\.md$/, "")}`;
export const selectCoreKnowledgeProducts = ({ sources, basis, context }: { readonly sources: CoreKnowledgeSources; readonly basis: SourceBasis; readonly context: AuthoredProseContext }): Outcome<ProjectionSetRequest> => {
  if (basis.source.kind !== "core" || sources.documents.length === 0 || sources.documents.some((knowledge) => sourceKey(knowledge.origin.source) !== sourceKey(basis.source) || knowledge.origin.pin !== basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-knowledge-products", detail: "authored core knowledge products must preserve the selected framework source basis" })] };
  if ((!context.invocation.startsWith("bun ") && !isNativeDocumentContext(context))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-knowledge-products", detail: "this producer qualifies authored knowledge text for Bun copy or explicit Claude native delivery" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: context }), units: sources.documents.map((knowledge) => ({ kind: "knowledge", key: knowledgeUnitKey({ relativePath: knowledge.relativePath }), input: { document: knowledge, context } })) } };
};
export const createCoreKnowledgeProductServices = ({ processes = createNativeCompilerProcessOperations }: { readonly processes?: NativeCompilerProcessFactory } = {}): CoreKnowledgeProductServices => ({ commands: input => prepareNativeProjectionCommands({ ...input, processes }), reader: createCoreKnowledgeSourceReader(), select: selectCoreKnowledgeProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
export const prepareCoreKnowledgeProducts = ({ sourceRoot, basis, context, mode, services = createCoreKnowledgeProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly mode: number; readonly services?: CoreKnowledgeProductServices }): Promise<Outcome<CoreKnowledgeProducts>> => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.select({ sources, basis, context }), consume: async ({ prepared: selection }) => continuePreparation({
      previous: services.project(selection), consume: async ({ prepared: rendered }) => continuePreparation({
        previous: (services.commands ?? prepareNativeProjectionCommands)({ projection: rendered, sourceRoot, basis, context }), consume: async ({ prepared: commands }) => continuePreparation({
        previous: services.products({ projection: commands.projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection: commands.projection, inputs: [...sources.inputs, ...commands.inputs], products } }),
        }),
      }),
    }),
  }),
});
