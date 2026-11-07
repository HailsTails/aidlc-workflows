import type { HarnessManifest } from "./manifest-types.ts";

export type PluginTargetDeclaration = Pick<HarnessManifest, "name" | "harnessDir" | "plugin">;

export type PluginAuthoringTarget = {
  readonly harnessName: string;
  readonly manifestDir: string;
  readonly marketplaceDir: string;
  readonly hostCatalogue: NonNullable<NonNullable<PluginTargetDeclaration["plugin"]>["hostCatalogue"]>;
  readonly harnessLeaf: string;
  readonly kind: NonNullable<PluginTargetDeclaration["plugin"]>["kind"];
  readonly installRoots: string[];
};

export function projectPluginTarget({ manifest, installRoots }: {
  readonly manifest: PluginTargetDeclaration;
  readonly installRoots: ReadonlySet<string>;
}): PluginAuthoringTarget {
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
