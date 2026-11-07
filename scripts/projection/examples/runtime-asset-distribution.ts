import { createRuntimeAssetSourceReader, type RuntimeAssetSourceReader } from "../src/adapters/runtime-asset-sources.ts";
import { prepareRuntimeAssets } from "../src/domain/runtime-assets.ts";
import { planPreparedRuntimeFiles } from "../src/domain/prepared-runtime-files.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import type { DistributionAssemblyRules } from "../src/application/distribution-assembly.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import type { RuntimeInputPreparer } from "../src/domain/runtime-inputs.ts";
export type RuntimeAssetDistributionServices = { readonly reader: RuntimeAssetSourceReader; readonly prepare: typeof prepareRuntimeAssets; readonly admit: typeof planPreparedRuntimeFiles; readonly rules: Pick<DistributionAssemblyRules, "path"> };
export const createRuntimeAssetDistributionServices = (): RuntimeAssetDistributionServices => ({ reader: createRuntimeAssetSourceReader(), prepare: prepareRuntimeAssets, admit: planPreparedRuntimeFiles, rules: createDistributionAssemblyRules() });
export const createRuntimeAssetPreparer = ({ services = createRuntimeAssetDistributionServices() }: { readonly services?: RuntimeAssetDistributionServices } = {}): RuntimeInputPreparer => ({ prepare: async ({ sourceRoot, basis, binding, mode }) => {
  const sources = await services.reader.load({ sourceRoot, basis });
  return sources.status === "invalid" ? sources : { status: "ok", value: services.prepare({ sources: sources.value, binding, mode }) };
} });
export const createRuntimeAssetDistributionSource = ({ source, mode, services = createRuntimeAssetDistributionServices(), create = createPreparedInputDistributionSource, createPreparer = createRuntimeAssetPreparer }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly services?: RuntimeAssetDistributionServices; readonly create?: typeof createPreparedInputDistributionSource; readonly createPreparer?: typeof createRuntimeAssetPreparer }): PreparedDistributionSource => create({ source, mode, preparer: createPreparer({ services }), admit: services.admit, rules: services.rules });
