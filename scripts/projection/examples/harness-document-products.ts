import { nativeDocumentCommandSourcePaths } from "../src/adapters/native-document-commands.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import { createHarnessDocumentSourceReader, type HarnessDocumentSourceReader } from "../src/adapters/harness-document-sources.ts";
import { createHarnessDocumentPreparer, type HarnessDocumentPreparer } from "../src/adapters/harness-document-preparation.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import { harnessDocumentPlacements, type PreparedHarnessDocuments } from "../src/domain/harness-document.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { copyHarnessBinding, type HarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";

export type HarnessDocumentProducts = { readonly projection: ProjectionSet; readonly inputs: PreparedHarnessDocuments["inputs"]; readonly products: readonly DistributionProduct[] };
export type HarnessDocumentProductServices = { readonly reader: HarnessDocumentSourceReader; readonly preparation: HarnessDocumentPreparer; readonly select: typeof selectHarnessDocumentProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
export const selectHarnessDocumentProducts = ({ sources, basis, context }: { readonly sources: PreparedHarnessDocuments; readonly basis: SourceBasis; readonly context: HarnessBinding & { readonly invocation?: string } }): Outcome<ProjectionSetRequest> => {
  const authoringPaths = ["harness/claude/manifest.ts", "scripts/earlier-release-regions.ts", ...(context.invocation === "aidlc" ? nativeDocumentCommandSourcePaths() : [])];
  if (context.harness !== "claude" || basis.source.kind !== "core" || basis.source.id !== "framework" || sources.documents.some((document) => document.binding.harness !== context.harness || document.binding.directory !== context.directory || sourceKey(document.authored.origin.source) !== sourceKey(basis.source) || document.authored.origin.pin !== basis.pin || document.authoring.length !== authoringPaths.length || authoringPaths.some(path => document.authoring.filter(origin => origin.path === path).length !== 1) || document.authoring.some((origin) => sourceKey(origin.source) !== sourceKey(basis.source) || origin.pin !== basis.pin))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "harness-document-products", detail: "authored entry products require the Claude binding and complete selected-source authoring provenance" })] };
  if (sources.documents.length !== 4 || harnessDocumentPlacements().some((placement) => sources.documents.filter((document) => document.authored.role === placement.role).length !== 1)) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "harness-document-products", detail: "publish the four distinct authored Claude entry documents atomically" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: context }), units: sources.documents.map((document) => ({ kind: "harness-document", key: `harness-${document.authored.role}`, input: { document, context: copyHarnessBinding({ binding: context }) } })) } };
};
export const createHarnessDocumentProductServices = (): HarnessDocumentProductServices => ({ reader: createHarnessDocumentSourceReader(), preparation: createHarnessDocumentPreparer(), select: selectHarnessDocumentProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
export const prepareHarnessDocumentProducts = ({ sourceRoot, basis, context, mode, services = createHarnessDocumentProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly mode: number; readonly services?: HarnessDocumentProductServices }): Promise<Outcome<HarnessDocumentProducts>> => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis, binding: copyHarnessBinding({ binding: context }) }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.preparation.prepare({ sourceRoot, basis, context, sources }), consume: async ({ prepared: documents }) => continuePreparation({
      previous: services.select({ sources: documents, basis, context }), consume: async ({ prepared: selection }) => continuePreparation({
        previous: services.project(selection), consume: async ({ prepared: projection }) => continuePreparation({
          previous: services.products({ projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection, inputs: documents.inputs, products } }),
        }),
      }),
    }),
  }),
});
