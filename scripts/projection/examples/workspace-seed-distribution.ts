import { createSourceWorkspaceSeedPreparer } from "../src/adapters/source-workspace-seed.ts";
import { createPreparedInputDistributionSource } from "../src/adapters/prepared-input-source.ts";
import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
export const createWorkspaceSeedDistributionSource = ({ source, mode, create = createPreparedInputDistributionSource, prepare = createSourceWorkspaceSeedPreparer }: { readonly source: PreparedDistributionSource; readonly mode: number; readonly create?: typeof createPreparedInputDistributionSource; readonly prepare?: typeof createSourceWorkspaceSeedPreparer }): PreparedDistributionSource => create({ source, mode, preparer: prepare() });
