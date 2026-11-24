import type { PluginId } from "./identities.ts";
import type { CoreContent, Method } from "./method.ts";
import type { MethodSource } from "./method-source.ts";

export type PluginBuildTarget = { readonly plugin: PluginId; readonly directory: string };

export type AuthoredCoreMethod = {
  readonly method: Method;
  readonly authored: CoreContent;
  readonly sources: readonly MethodSource[];
};

export type AuthoredPluginBuild = {
  readonly method: Method;
  readonly plugins: readonly PluginBuildTarget[];
};
