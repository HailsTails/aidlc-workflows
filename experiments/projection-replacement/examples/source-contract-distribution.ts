import { createSourceRuntimeContractPreparer } from "../src/adapters/source-runtime-contracts.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
export const createSourceContractDistributionSource = ({ source, mode, create = createPreparedInputDistributionSource, prepare = createSourceRuntimeContractPreparer }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly create?: typeof createPreparedInputDistributionSource; readonly prepare?: typeof createSourceRuntimeContractPreparer }): PreparedDistributionSource => create({ source, mode, preparer: prepare() });
