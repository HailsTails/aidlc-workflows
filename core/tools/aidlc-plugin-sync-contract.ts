import type { PlannedWorkflowRefresh } from "./aidlc-workflow-refresh.ts";
import type { WorkflowRefreshPolicy } from "./aidlc-workflow-refresh-contract.ts";

export type HeldRecord = {
  schemaVersion: 1;
  name: string;
  version: string;
  reason: string;
};

type PluginSyncInvocation = { readonly projectDir: string; readonly argv: string[]; readonly harnessDir: string };
export type LegacyPluginSyncRequest = PluginSyncInvocation & { readonly kind: "legacy" };
export type SelectedPluginSyncRequest = PluginSyncInvocation & { readonly kind: "selected"; readonly refreshPolicy: WorkflowRefreshPolicy };
export type PluginSyncRequest = LegacyPluginSyncRequest | SelectedPluginSyncRequest;

export type PluginSyncRefusal = { readonly kind: "refused" | "transaction-busy"; readonly message: string };

export type PluginSyncResult = {
  synced: string[];
  pruned: string[];
  operations: number;
  held: HeldRecord[];
  newlyHeld: HeldRecord[];
  paused: string[];
  superseded: string[];
  skippedCommands: string[];
  rules: string[];
  readonly refreshCompatibility?: PlannedWorkflowRefresh["evidence"];
  readonly refreshNotes?: readonly string[];
};

export type PluginSyncOutcome = PluginSyncResult | PluginSyncRefusal;
