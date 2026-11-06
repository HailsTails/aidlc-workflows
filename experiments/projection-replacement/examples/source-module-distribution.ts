import { createSourceRuntimeModulePreparer } from "../src/adapters/source-runtime-modules.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
export const createSourceModuleDistributionSource = ({ source, mode, create = createPreparedInputDistributionSource, prepare = createSourceRuntimeModulePreparer }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly create?: typeof createPreparedInputDistributionSource; readonly prepare?: typeof createSourceRuntimeModulePreparer }): PreparedDistributionSource => create({ source, mode, preparer: prepare() });
