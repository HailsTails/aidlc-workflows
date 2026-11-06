import { createPreparedDistributionSource, type PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import { createSourceRuntimeContextReader } from "../src/adapters/source-runtime-context.ts";
export const createSourceContextDistributionSource = ({ mode, create = createPreparedDistributionSource, context = createSourceRuntimeContextReader }: { readonly mode: number; readonly create?: typeof createPreparedDistributionSource; readonly context?: typeof createSourceRuntimeContextReader }): PreparedDistributionSource => create({ context: context({ mode }) });
