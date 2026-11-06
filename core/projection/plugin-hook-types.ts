export type PluginHookRow = {
  event: string;
  matcher?: string;
  target: string;
  capabilityId?: string;
  hookFile: string;
  pluginName: string;
};

export type NativeHookGroup =
  | {
      readonly matcher?: string;
      readonly hooks: readonly { readonly type: "command"; readonly command: string }[];
    }
  | {
      readonly type: "command";
      readonly bash: string;
      readonly powershell: string;
      readonly timeoutSec: number;
    };

export type PluginHookContribution =
  | { readonly kind: "group"; readonly path: string; readonly event: string; readonly group: NativeHookGroup }
  | { readonly kind: "target"; readonly path: string; readonly target: string; readonly hookFile: string }
  | { readonly kind: "event-body"; readonly path: string; readonly event: string; readonly hookFile: string }
  | { readonly kind: "event-row"; readonly path: string; readonly row: PluginHookRow };

export type ProjectedPluginHookContributions<Harness extends string> = {
  readonly schemaVersion: 1;
  readonly pluginName: string;
  readonly harness: Harness;
  readonly registrations: readonly PluginHookContribution[];
};

export type PluginHookProjectionInput<Harness extends string> = {
  pluginName: string;
  harness: Harness;
  harnessDir: string;
  invocation: string;
  trustedNamespace: string;
  rows: readonly PluginHookRow[];
};
