import type { PreparedDistributionSource } from "../src/adapters/prepared-distribution-source.ts";
import type { DistributionStructure } from "../src/domain/distribution-structure.ts";
export const createArtifactStructureSource = ({ source, structure }: { readonly source: PreparedDistributionSource; readonly structure: DistributionStructure }): PreparedDistributionSource => ({ load: async (request) => {
  const seed = await source.load(request);
  return seed.status === "invalid" ? seed : { status: "ok", value: { ...seed.value, structure } };
} });
