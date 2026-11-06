import {
  captureWorkflowRefreshInputs,
  combineRefreshChecks,
  planWorkflowRefresh,
  validateEmptyRefreshPlan,
  type PlannedWorkflowRefresh,
  type WorkflowRefreshInputs,
} from "./aidlc-workflow-refresh.ts";
import type { WorkflowRefreshPolicy } from "./aidlc-workflow-refresh-contract.ts";
import { executePlan, TransactionBusyError, withTransactionFix, type TransactionOptions, type TransactionPlan } from "./aidlc-transaction.ts";
import { withAuditLock } from "./aidlc-locks.ts";
import type { PluginSyncRefusal, PluginSyncResult } from "./aidlc-plugin-sync-contract.ts";

export type PluginSyncRefreshOutcome<Value> =
  | { readonly kind: "ready"; readonly value: Value }
  | PluginSyncRefusal;

export type PluginSyncRefresh = {
  readonly projectDir: string;
  readonly harnessDir: string;
  readonly policy: WorkflowRefreshPolicy;
  readonly inputs: WorkflowRefreshInputs;
};

export type PluginSyncRefreshOperations = {
  readonly capture: (input: { readonly projectDir: string; readonly harnessDir: string }) => WorkflowRefreshInputs;
  readonly plan: typeof planWorkflowRefresh;
};

export const createPluginSyncRefreshOperations = (): PluginSyncRefreshOperations => ({
  capture: ({ projectDir, harnessDir }) => captureWorkflowRefreshInputs(projectDir, harnessDir),
  plan: planWorkflowRefresh,
});

type PluginSyncRefreshReview = PluginSyncRefreshOutcome<PlannedWorkflowRefresh>;
export type PluginSyncRefreshApplyOperations = PluginSyncRefreshOperations & {
  readonly validateEmpty: (input: { readonly plan: TransactionPlan; readonly options: TransactionOptions }) => void;
  readonly execute: (input: { readonly plan: TransactionPlan; readonly options: TransactionOptions }) => void;
  readonly locked: (input: { readonly projectDir: string; readonly action: () => PluginSyncRefreshReview }) => PluginSyncRefreshReview;
};
export const createPluginSyncRefreshApplyOperations = (): PluginSyncRefreshApplyOperations => ({
  ...createPluginSyncRefreshOperations(),
  validateEmpty: ({ plan, options }) => validateEmptyRefreshPlan(plan, options),
  execute: ({ plan, options }) => executePlan(plan, options),
  locked: ({ projectDir, action }) => withAuditLock(projectDir, action, undefined, undefined, 600),
});

export const pluginSyncRefreshFailure = ({ error }: { readonly error: unknown }): PluginSyncRefusal => ({
  kind: error instanceof TransactionBusyError ? "transaction-busy" : "refused",
  message: withTransactionFix(error, error instanceof Error && error.message.trim().length > 0 ? error.message : "Plugin refresh compatibility could not be established; review the plugin source and refresh again."),
});

export const capturePluginSyncRefresh = ({
  projectDir, harnessDir, policy, operations = createPluginSyncRefreshOperations(),
}: {
  readonly projectDir: string;
  readonly harnessDir: string;
  readonly policy: WorkflowRefreshPolicy | undefined;
  readonly operations?: PluginSyncRefreshOperations;
}): PluginSyncRefreshOutcome<PluginSyncRefresh | null> => {
  if (policy === undefined) return { kind: "ready", value: null };
  try {
    return { kind: "ready", value: { projectDir, harnessDir, policy, inputs: operations.capture({ projectDir, harnessDir }) } };
  } catch (error) { return pluginSyncRefreshFailure({ error }); }
};

export const planPluginSyncRefresh = ({
  refresh, plan, operations = createPluginSyncRefreshOperations(),
}: {
  readonly refresh: PluginSyncRefresh;
  readonly plan: TransactionPlan;
  readonly operations?: PluginSyncRefreshOperations;
}): PluginSyncRefreshReview => {
  try {
    return { kind: "ready", value: operations.plan({ ...refresh, plan }) };
  } catch (error) { return pluginSyncRefreshFailure({ error }); }
};

type PluginSyncRefreshWork = { readonly kind: "validate-empty" | "execute"; readonly plan: TransactionPlan; readonly options: TransactionOptions };
const preparePluginSyncRefreshWork = ({ plan, existing, review }: { readonly plan: TransactionPlan; readonly existing: TransactionOptions; readonly review: PlannedWorkflowRefresh }): PluginSyncRefreshWork => ({
  kind: plan.operations.length === 0 ? "validate-empty" : "execute", plan,
  options: pluginSyncTransactionOptions({ existing, review }),
});
const performPluginSyncRefreshWork = ({ work, operations }: { readonly work: PluginSyncRefreshWork; readonly operations: PluginSyncRefreshApplyOperations }): void => {
  const handlers = { "validate-empty": operations.validateEmpty, execute: operations.execute };
  handlers[work.kind]({ plan: work.plan, options: work.options });
};
const consumePluginSyncReview = ({ prepared, consume }: { readonly prepared: PluginSyncRefreshReview; readonly consume: (input: { readonly review: PlannedWorkflowRefresh }) => PluginSyncRefreshReview }): PluginSyncRefreshReview => prepared.kind !== "ready" ? prepared : consume({ review: prepared.value });
const applyPreparedPluginSyncRefresh = ({ refresh, plan, existing, operations }: { readonly refresh: PluginSyncRefresh; readonly plan: TransactionPlan; readonly existing: TransactionOptions; readonly operations: PluginSyncRefreshApplyOperations }): PluginSyncRefreshReview => consumePluginSyncReview({
  prepared: planPluginSyncRefresh({ refresh, plan, operations }), consume: ({ review }) => {
    const work = preparePluginSyncRefreshWork({ plan, existing, review });
    performPluginSyncRefreshWork({ work, operations });
    return { kind: "ready", value: review };
  },
});

// The plugin-sync audit identity serializes composers only. Final assessment
// and commit use config/state's default audit identity, after children exit.
export const applySelectedPluginSyncRefresh = ({ refresh, plan, existing, operations = createPluginSyncRefreshApplyOperations() }: {
  readonly refresh: PluginSyncRefresh;
  readonly plan: TransactionPlan;
  readonly existing: TransactionOptions;
  readonly operations?: PluginSyncRefreshApplyOperations;
}): PluginSyncRefreshReview => {
  try {
    return operations.locked({ projectDir: refresh.projectDir, action: () => applyPreparedPluginSyncRefresh({ refresh, plan, existing, operations }) });
  } catch (error) { return pluginSyncRefreshFailure({ error }); }
};

export const pluginSyncTransactionOptions = ({ existing, review }: {
  readonly existing: TransactionOptions;
  readonly review: PlannedWorkflowRefresh | null;
}): TransactionOptions => review === null ? existing : { ...existing, ...combineRefreshChecks(existing, review.checks) };

export const pluginSyncRefreshResult = ({ syncResult, review }: {
  readonly syncResult: PluginSyncResult;
  readonly review: PlannedWorkflowRefresh | null;
}): PluginSyncResult => review === null ? syncResult : { ...syncResult, refreshCompatibility: review.evidence, refreshNotes: review.notes };

export const pluginSyncRefreshNotice = ({ syncResult, format }: {
  readonly syncResult: PluginSyncResult;
  readonly format: "json" | "text";
}): string => format === "json" || syncResult.refreshNotes === undefined || syncResult.refreshNotes.length === 0 ? "" : `${syncResult.refreshNotes.join("\n")}\n`;

export type PluginSyncArgumentAdmission = { readonly kind: "accepted" } | { readonly kind: "usage"; readonly message: string };
export const admitPluginSyncArguments = ({ flags, policy }: {
  readonly flags: Readonly<Record<string, string>>;
  readonly policy: WorkflowRefreshPolicy | undefined;
}): PluginSyncArgumentAdmission => policy !== undefined && (Object.hasOwn(flags, "dry-run") || Object.hasOwn(flags, "plan-token"))
  ? { kind: "usage", message: "Plugin sync applies changes directly; --dry-run and --plan-token are not supported. No changes were made." }
  : { kind: "accepted" };
