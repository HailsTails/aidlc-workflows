import { createSourcePluginAuthoringPreparer } from "../src/adapters/source-plugin-authoring.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
export const createPluginAuthoringDistributionSource = ({ source, mode, create = createPreparedInputDistributionSource, prepare = createSourcePluginAuthoringPreparer }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly create?: typeof createPreparedInputDistributionSource; readonly prepare?: typeof createSourcePluginAuthoringPreparer }): PreparedDistributionSource => create({ source, mode, preparer: prepare() });
