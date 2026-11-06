import { continuePreparation } from "../src/application/preparation-result.ts";
import { createCoreSensorSourceReader, type CoreSensorSourceReader } from "../src/adapters/core-sensor-sources.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { CoreSensorSources } from "../src/domain/sensor-definition.ts";
import type { AuthoredProseContext } from "../src/domain/authored-prose.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { finding, type Outcome } from "../src/domain/model.ts";

export type CoreSensorProducts = { readonly projection: ProjectionSet; readonly inputs: CoreSensorSources["inputs"]; readonly products: readonly DistributionProduct[] };
export type CoreSensorProductServices = { readonly reader: CoreSensorSourceReader; readonly select: typeof selectCoreSensorProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
export const selectCoreSensorProducts = ({ sources, basis, context }: { readonly sources: CoreSensorSources; readonly basis: SourceBasis; readonly context: AuthoredProseContext }): Outcome<ProjectionSetRequest> => {
  if (basis.source.kind !== "core" || basis.source.id !== "framework" || sources.documents.length === 0 || sources.documents.some((sensor) => sensor.origin.source.kind !== basis.source.kind || sensor.origin.source.id !== basis.source.id || sensor.origin.pin !== basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-sensor-products", detail: "authored core sensors must preserve the selected framework source basis" })] };
  if (context.harness !== "claude" || context.invocation !== "bun .claude/tools/aidlc.ts") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-sensor-products", detail: "this core sensor producer qualifies Claude Bun-copy definitions; other delivery profiles require separate verified preparation" })] };
  return { status: "ok", value: { target: { harness: "claude", directory: ".claude" }, units: sources.documents.map((sensor) => ({ kind: "sensor", key: `sensor-${sensor.fileName.slice("aidlc-".length, -".md".length)}`, input: { document: sensor, context } })) } };
};
export const createCoreSensorProductServices = (): CoreSensorProductServices => ({ reader: createCoreSensorSourceReader(), select: selectCoreSensorProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
export const prepareCoreSensorProducts = ({ sourceRoot, basis, context, mode, services = createCoreSensorProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: AuthoredProseContext; readonly mode: number; readonly services?: CoreSensorProductServices }): Promise<Outcome<CoreSensorProducts>> => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.select({ sources, basis, context }), consume: async ({ prepared: selection }) => continuePreparation({
      previous: services.project(selection), consume: async ({ prepared: projection }) => continuePreparation({
        previous: services.products({ projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection, inputs: sources.inputs, products } }),
      }),
    }),
  }),
});
