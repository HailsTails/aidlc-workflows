import type { HarnessBinding } from "./harness-binding.ts";
import type { NativeResource } from "./native-rendering.ts";
import type { SourceBasis, SourceOrigin } from "./source-origin.ts";
import type { Outcome } from "./model.ts";

export type PluginHookProjectionRequest = {
  readonly binding: HarnessBinding;
  readonly declaration: { readonly origin: SourceOrigin; readonly text: string };
  readonly runtime: { readonly basis: SourceBasis; readonly authoredFiles: readonly string[]; readonly projectedFiles: readonly string[] };
};
export type PluginHookProjection = {
  readonly owner: SourceBasis;
  readonly declaration: SourceOrigin;
  readonly compiler: SourceOrigin;
  readonly runtime: SourceBasis;
  readonly binding: HarnessBinding;
  readonly registrations: number;
  readonly resources: readonly [NativeResource];
};
export type PluginHookProjector = {
  readonly project: (input: PluginHookProjectionRequest) => Promise<Outcome<PluginHookProjection>>;
};
