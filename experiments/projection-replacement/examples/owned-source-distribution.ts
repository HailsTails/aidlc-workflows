import { prepareRunnerRequirements, type PreparedRunnerRequirements } from "./runner-requirements.ts";
import { createDistributionSource, type DistributionSource, type DistributionSourceLocation } from "../src/adapters/distribution-source.ts";
import { createDistributionProductReconciler, type DistributionProductReconciler, type DistributionProductEdit, type ReconciledDistribution } from "../src/domain/distribution-products.ts";
import { pathStatus, type Outcome } from "../src/domain/model.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import { nativeProducerRequiredPaths } from "../src/application/native-runner-requirements.ts";
export type OwnedSourceArchive = { readonly distribution: ReconciledDistribution; readonly archive: Uint8Array; readonly requirements: PreparedRunnerRequirements["requirements"] };
export type OwnedSourceDistributionServices = { readonly prepare: typeof prepareRunnerRequirements; readonly reconciler: DistributionProductReconciler; readonly archive: DistributionSource["archive"] };
export const createOwnedSourceDistributionServices = (): OwnedSourceDistributionServices => ({ prepare: prepareRunnerRequirements, reconciler: createDistributionProductReconciler({ rules: { path: pathStatus } }), archive: createDistributionSource().archive });
export const assembleOwnedSourceDistribution = async ({ location, edits, sources, protectedPaths = [], services = createOwnedSourceDistributionServices() }: { readonly location: DistributionSourceLocation; readonly edits: readonly DistributionProductEdit[]; readonly sources: readonly SourceBasis[]; readonly protectedPaths?: readonly string[]; readonly services?: OwnedSourceDistributionServices }): Promise<Outcome<OwnedSourceArchive>> => {
  const prepared = await services.prepare({ location });
  if (prepared.status === "invalid") return prepared;
  const reconciled = services.reconciler.reconcile({ seed: prepared.value.seed, edits, sources, protectedPaths, requiredPaths: nativeProducerRequiredPaths({ requirements: prepared.value.requirements, stageDocuments: prepared.value.stageDocuments }) });
  if (reconciled.status === "invalid") return reconciled;
  const packed = await services.archive({ sourceRoot: location.sourceRoot, distribution: reconciled.value });
  return packed.status === "invalid" ? packed : { status: "ok", value: { distribution: reconciled.value, archive: packed.value, requirements: prepared.value.requirements } };
};
