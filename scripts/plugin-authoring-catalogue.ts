import type { HarnessManifest } from "./manifest-types.ts";
import type { PluginTarget } from "../core/tools/aidlc-plugin-emit.ts";

export type PluginTargetDeclaration = Pick<HarnessManifest, "name" | "harnessDir" | "plugin">;

export function projectPluginTarget({ manifest, installRoots }: {
  readonly manifest: PluginTargetDeclaration;
  readonly installRoots: ReadonlySet<string>;
}): PluginTarget {
  const manifestDir = manifest.plugin?.manifestDir ?? `${manifest.harnessDir}-plugin`;
  return {
    harnessName: manifest.name,
    manifestDir,
    marketplaceDir: manifest.plugin?.marketplaceDir ?? manifestDir,
    hostCatalogue: manifest.plugin?.hostCatalogue ??
      ["store", "cursor"].includes(manifest.plugin?.kind ?? "store"),
    harnessLeaf: manifest.harnessDir,
    kind: manifest.plugin?.kind ?? "store",
    installRoots: [...installRoots].sort(),
  };
}

export function sortPluginAuthoringNames({ names }: {
  readonly names: readonly string[];
}): string[] {
  return [...names].sort();
}
