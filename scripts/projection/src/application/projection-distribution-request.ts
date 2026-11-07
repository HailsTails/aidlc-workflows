import type { DistributionSeed } from "../domain/distribution-artifact.ts";
import type { DistributionProduct } from "../domain/distribution-products.ts";
import type { ProjectionSet } from "./projection-set.ts";

export type ProjectionDistributionRequest = { readonly sourceRoot: string; readonly seed: DistributionSeed; readonly projection: ProjectionSet; readonly mode: number; readonly preparedProducts?: readonly DistributionProduct[] };
