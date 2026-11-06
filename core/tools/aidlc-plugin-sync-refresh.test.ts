import { expect, mock, test } from "bun:test";
import {
  admitPluginSyncArguments, capturePluginSyncRefresh, planPluginSyncRefresh, pluginSyncRefreshFailure,
  pluginSyncRefreshNotice, pluginSyncRefreshResult, pluginSyncTransactionOptions,
} from "./aidlc-plugin-sync-refresh.ts";
import type { PluginSyncRefreshOperations } from "./aidlc-plugin-sync-refresh.ts";
import type { WorkflowRefreshInputs, PlannedWorkflowRefresh } from "./aidlc-workflow-refresh.ts";
import type { PluginSyncResult } from "./aidlc-plugin-sync-contract.ts";
import { TransactionFilesystemError } from "./aidlc-transaction.ts";

const inputs: WorkflowRefreshInputs = {
  workspace: { hashes: { "aidlc/scopes/": null }, open: [{ workflow: "fixture-work", currentStage: "fixture-stage" }] },
  installed: { contract: { stateVersion: "8", stages: { "fixture-stage": { slug: "fixture-stage" } }, scopes: { fixture: {} } }, hashes: { ".claude/tools/data/stage-graph.json": "installed-stage-digest" } },
};
const policy = { id: "fixture-policy-v1", compareStages: () => ({ kind: "invalid" as const }), notes: () => ["Review the changed fixture stage before resuming."] };
const refresh = { projectDir: "fixture-project", harnessDir: ".claude", policy, inputs };
const review: PlannedWorkflowRefresh = {
  evidence: { policy: "fixture-policy-v1", installed: { graph: "before" }, candidate: { graph: "after" }, workspaceInputs: {}, openWorkflows: [{ workflow: "fixture-work", currentStage: "fixture-stage" }], stageRevalidation: { "fixture-stage": ["fixture-effect"] } },
  notes: ["Review the changed fixture stage before resuming."],
  checks: { validateLocked: () => undefined, validateCandidates: () => undefined, validateCommitted: () => undefined },
};
const syncResult: PluginSyncResult = { synced: ["fixture"], pruned: [], operations: 1, held: [], newlyHeld: [], paused: [], superseded: [], skippedCommands: [], rules: [] };
const emptyPlan = { schemaVersion: 1 as const, root: "fixture-project", operations: [] };
const changedPlan = { schemaVersion: 1 as const, root: "fixture-project", operations: [{ kind: "remove" as const, path: ".claude/retired.md", expected: "absent" }] };

test("unselected policy performs no capture and preserves the legacy result", () => {
  const capture = mock();
  expect(capturePluginSyncRefresh({ projectDir: "fixture-project", harnessDir: ".claude", policy: undefined, operations: { capture, plan: mock() } })).toEqual({ kind: "ready", value: null });
  expect(pluginSyncRefreshResult({ syncResult, review: null })).toBe(syncResult);
  expect(capture).not.toHaveBeenCalled();
});

test("selected policy captures the original work once and plans against that same capture", () => {
  const capture = mock<PluginSyncRefreshOperations["capture"]>(() => inputs);
  const plan = mock<PluginSyncRefreshOperations["plan"]>(() => review);
  expect(capturePluginSyncRefresh({ projectDir: "fixture-project", harnessDir: ".claude", policy, operations: { capture, plan } })).toEqual({ kind: "ready", value: refresh });
  expect(planPluginSyncRefresh({ refresh, plan: changedPlan, operations: { capture, plan } })).toEqual({ kind: "ready", value: review });
  expect(capture.mock.calls).toEqual([[{ projectDir: "fixture-project", harnessDir: ".claude" }]]);
  expect(plan.mock.calls).toEqual([[{ projectDir: "fixture-project", harnessDir: ".claude", policy, inputs, plan: changedPlan }]]);
});

test.each([emptyPlan, changedPlan])("planning returns the review independently of transaction mode", (plan) => {
  expect(planPluginSyncRefresh({ refresh, plan, operations: { capture: mock(), plan: () => review } })).toEqual({ kind: "ready", value: review });
});

test.each([
  { error: new Error("fixture policy could not prove the new stage"), expected: { kind: "refused", message: "fixture policy could not prove the new stage" } },
  { error: "unstructured native failure", expected: { kind: "refused", message: "Plugin refresh compatibility could not be established; review the plugin source and refresh again." } },
  { error: new Error(""), expected: { kind: "refused", message: "Plugin refresh compatibility could not be established; review the plugin source and refresh again." } },
])("native failure guidance remains data", ({ error, expected }) => {
  expect(pluginSyncRefreshFailure({ error })).toEqual(expected);
});

test("native filesystem refusals keep their existing recovery guidance", () => {
  expect(pluginSyncRefreshFailure({ error: new TransactionFilesystemError("fixture-project", "snapshot", "ENOTSUP", null) })).toEqual({ kind: "refused", message: "Cannot use the filesystem at fixture-project: snapshot failed (ENOTSUP). fix: Use a mount that supports mutable files, exclusive creation, file synchronization, and file/directory rename, or use local storage such as ext4 or XFS on EC2/EBS. Directory locking supports cooperating processes on one host using one shared mount." });
});

test("compatibility result assembly retains evidence and owed work without a plan token", () => {
  expect(pluginSyncRefreshResult({ syncResult, review })).toEqual({ ...syncResult, refreshCompatibility: review.evidence, refreshNotes: ["Review the changed fixture stage before resuming."] });
});

test.each([
  { syncResult: { ...syncResult, refreshNotes: ["Review the changed fixture stage before resuming."] }, format: "text", expected: "Review the changed fixture stage before resuming.\n" },
  { syncResult: { ...syncResult, refreshNotes: ["Review the changed fixture stage before resuming."] }, format: "json", expected: "" },
  { syncResult, format: "text", expected: "" },
] as const)("notice output follows its explicit format", ({ syncResult, format, expected }) => {
  expect(pluginSyncRefreshNotice({ syncResult, format })).toBe(expected);
});

test("policy transaction checks compose in phase order and preserve failAfter", () => {
  const guard = mock<(input: { readonly phase: string }) => void>(() => undefined);
  const existing = { failAfter: 2, validateLocked: () => guard({ phase: "existing-locked" }), validateCandidates: () => guard({ phase: "existing-candidates" }), validateCommitted: () => guard({ phase: "existing-committed" }) };
  const policyReview = { ...review, checks: { validateLocked: () => guard({ phase: "policy-locked" }), validateCandidates: () => guard({ phase: "policy-candidates" }), validateCommitted: () => guard({ phase: "policy-committed" }) } };
  const options = pluginSyncTransactionOptions({ existing, review: policyReview });
  options.validateLocked?.();
  options.validateCandidates?.("fixture-candidate");
  options.validateCommitted?.();
  expect(options.failAfter).toBe(2);
  expect(guard.mock.calls).toEqual([[{ phase: "existing-locked" }], [{ phase: "policy-locked" }], [{ phase: "existing-candidates" }], [{ phase: "policy-candidates" }], [{ phase: "existing-committed" }], [{ phase: "policy-committed" }]]);
  expect(pluginSyncTransactionOptions({ existing, review: null })).toBe(existing);
});

const refusedArguments: Parameters<typeof admitPluginSyncArguments>[0][] = [
  { flags: { "dry-run": "true" }, policy },
  { flags: { "dry-run": "false" }, policy },
  { flags: { "dry-run": "" }, policy },
  { flags: { "plan-token": "fixture-token" }, policy },
  { flags: { "plan-token": "" }, policy },
  { flags: { "dry-run": "true", "plan-token": "fixture-token", json: "true" }, policy },
];
test.each(refusedArguments)("selected sync refuses configuration-only flags by presence", ({ flags, policy }) => {
  expect(admitPluginSyncArguments({ flags, policy })).toEqual({ kind: "usage", message: "Plugin sync applies changes directly; --dry-run and --plan-token are not supported. No changes were made." });
});

const supportedArguments: Parameters<typeof admitPluginSyncArguments>[0][] = [
  { flags: {}, policy },
  { flags: { json: "true", quiet: "true", "plugin-root": "fixture-plugin", "rules-level": "fixture=project", "prune-missing": "true" }, policy },
  { flags: { "plugin-root": "--dry-run", "dry-run-extra": "true", "plan-token-file": "fixture" }, policy },
  { flags: { "dry-run": "true", "plan-token": "fixture-token" }, policy: undefined },
];
test.each(supportedArguments)("supported inputs and legacy sync remain admitted", ({ flags, policy }) => {
  expect(admitPluginSyncArguments({ flags, policy })).toEqual({ kind: "accepted" });
});
