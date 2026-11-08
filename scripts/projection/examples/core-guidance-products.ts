import { createNativeCompilerProcessOperations, type NativeCompilerProcessFactory } from "../src/adapters/native-compiler-process.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import { createCoreGuidanceSourceReader, type CoreGuidanceSourceReader } from "../src/adapters/core-guidance-sources.ts";
import { createGuidanceBindingPreparer, type GuidanceBindingPreparer } from "../src/adapters/guidance-bindings.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { CoreGuidanceSources, PreparedCoreGuidance, GuidancePlacement } from "../src/domain/core-guidance.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { copyHarnessBinding, type HarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";
export type CoreGuidanceProducts = { readonly projection: ProjectionSet; readonly inputs: CoreGuidanceSources["inputs"]; readonly products: readonly DistributionProduct[] };
export type CoreGuidanceProductServices = { readonly reader: CoreGuidanceSourceReader; readonly bindings: GuidanceBindingPreparer; readonly select: typeof selectCoreGuidanceProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
const guidanceUnitKey = ({ placement }: { readonly placement: GuidancePlacement }): string => {
  switch (placement.kind) {
    case "conductor": return "guidance-conductor";
    case "protocol": return `guidance-protocol-${placement.slug}`;
  }
};
export const selectCoreGuidanceProducts = ({ sources, basis, context }: { readonly sources: PreparedCoreGuidance; readonly basis: SourceBasis; readonly context: HarnessBinding }): Outcome<ProjectionSetRequest> => {
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || sources.documents.length === 0 || sources.documents.some((document) => sourceKey(document.authored.origin.source) !== sourceKey(basis.source) || document.authored.origin.pin !== basis.pin || document.authored.placement.kind === "protocol" && document.authoring.length === 0 || document.authoring.some((origin) => sourceKey(origin.source) !== sourceKey(basis.source) || origin.pin !== basis.pin))) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-guidance-products", detail: "authored guidance products must preserve the selected framework source basis" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: context }), units: sources.documents.map((document) => ({ kind: "guidance", key: guidanceUnitKey({ placement: document.authored.placement }), input: { document, context: copyHarnessBinding({ binding: context }) } })) } };
};
export const createCoreGuidanceProductServices = ({ processes = createNativeCompilerProcessOperations }: { readonly processes?: NativeCompilerProcessFactory } = {}): CoreGuidanceProductServices => ({ reader: createCoreGuidanceSourceReader(), bindings: createGuidanceBindingPreparer({ processes }), select: selectCoreGuidanceProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
export const prepareCoreGuidanceProducts = ({ sourceRoot, basis, context, mode, services = createCoreGuidanceProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly mode: number; readonly services?: CoreGuidanceProductServices }): Promise<Outcome<CoreGuidanceProducts>> => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis }), consume: async ({ prepared: rawSources }) => continuePreparation({
    previous: services.bindings.prepare({ sourceRoot, basis, context, sources: rawSources }), consume: async ({ prepared: sources }) => continuePreparation({
      previous: services.select({ sources, basis, context: copyHarnessBinding({ binding: context }) }), consume: async ({ prepared: selection }) => continuePreparation({
        previous: services.project(selection), consume: async ({ prepared: projection }) => continuePreparation({
          previous: services.products({ projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection, inputs: sources.inputs, products } }),
        }),
      }),
    }),
  }),
});
