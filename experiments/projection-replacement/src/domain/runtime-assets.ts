import type { SourceBasis, SourceOrigin, SourceContentDigest } from "./source-origin.ts";
import type { HarnessBinding } from "./harness-binding.ts";
import type { DistributionFile } from "./distribution-artifact.ts";
import type { RuntimeInputPreparation } from "./runtime-inputs.ts";
export type RuntimeAssetRelativePath = "ars-priors.json" | "model-rates.json" | "templates/.gitkeep";
export type AuthoredRuntimeAsset = { readonly origin: SourceOrigin; readonly relativePath: RuntimeAssetRelativePath; readonly bytes: Uint8Array };
export type RuntimeAssetSources = { readonly basis: SourceBasis; readonly assets: readonly AuthoredRuntimeAsset[]; readonly inputs: readonly SourceContentDigest[] };
export type PreparedRuntimeAssets = { readonly files: readonly DistributionFile[]; readonly preparation: RuntimeInputPreparation };
export const prepareRuntimeAssets = ({ sources, binding, mode }: { readonly sources: RuntimeAssetSources; readonly binding: HarnessBinding; readonly mode: number }): PreparedRuntimeAssets => {
  const files = sources.assets.map((asset) => ({ path: `${binding.directory}/tools/data/${asset.relativePath}`, bytes: asset.bytes.slice(), mode }));
  return { files, preparation: { kind: "runtime-assets", paths: files.map((file) => file.path), inputs: sources.inputs } };
};
