import type { HarnessBinding } from "./harness-binding.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { SourceBasis, SourceContentDigest, SourceOrigin } from "./source-origin.ts";
import type { Outcome } from "./model.ts";

export type PreparedPluginHookRuntime = {
  readonly owner: SourceBasis;
  readonly compiler: SourceOrigin;
  readonly binding: HarnessBinding;
  readonly inputs: readonly SourceContentDigest[];
  readonly resources: readonly NativeResource[];
};
export type PluginHookRuntimeRequest = { readonly pluginId: string; readonly binding: HarnessBinding };
export type PluginHookRuntimePreparer = { readonly prepare: (request: PluginHookRuntimeRequest) => Promise<Outcome<PreparedPluginHookRuntime>> };
