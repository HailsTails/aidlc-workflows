// Literal-contract composition controls, not an emitted-plugin upgrade or host test.
import { expect, mock, test } from "bun:test";
import { createDefaultFixtureWorkspace, type FixtureWorkspace } from "../harness/fixture-workspace.ts";
import { applySelectedPluginSyncRefresh, capturePluginSyncRefresh, createPluginSyncRefreshApplyOperations, type PluginSyncRefresh } from "../../core/tools/aidlc-plugin-sync-refresh.ts";
import { stageRefreshComparison } from "../../core/tools/aidlc-stage-refresh-contract.ts";
import { executePlan, transactionState, validateTransactionPlan, writeOperation, type TransactionPlan } from "../../core/tools/aidlc-transaction.ts";
import { holdsAuditLock } from "../../core/tools/aidlc-locks.ts";
import { captureWorkflowRefreshInputs } from "../../core/tools/aidlc-workflow-refresh.ts";

const graphPath = ".claude/tools/data/stage-graph.json";
const statePath = "aidlc/spaces/default/intents/open/aidlc-state.md";
const installedGraph = '[{"slug":"work","approval_mode":"autonomous","produces":["result"],"sensors":[],"sensors_applicable":[]}]';
const unreviewedGraph = '[{"slug":"work","approval_mode":"human","produces":["result"],"sensors":[],"sensors_applicable":[]}]';
const policy = { id: "fixture-core-v1", compareStages: stageRefreshComparison, notes: () => [] };
const populate = ({ workspace }: { readonly workspace: FixtureWorkspace }): void => {
  workspace.write(".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "8";\n');
  workspace.write(graphPath, installedGraph);
  workspace.write(".claude/tools/data/scope-grid.json", '{"fixture":{"stages":{"work":"EXECUTE"}}}');
  workspace.write(statePath, "# Synthetic state fixture\n- **Status**: Running\n- **Current Stage**: work\n");
  workspace.write(".claude/tools/payload.ts", "before\n");
};
const capture = ({ workspace }: { readonly workspace: FixtureWorkspace }): PluginSyncRefresh => ({ projectDir: workspace.root, harnessDir: ".claude", policy, inputs: captureWorkflowRefreshInputs(workspace.root, ".claude") });
const payloadPlan = ({ workspace }: { readonly workspace: FixtureWorkspace }): TransactionPlan => ({ schemaVersion: 1, root: workspace.root, operations: [writeOperation(".claude/tools/payload.ts", "after\n", transactionState(workspace.path(".claude/tools/payload.ts")))] });

test("missing installed metadata is refused as data before composition", () => {
  using workspace = createDefaultFixtureWorkspace();
  expect(capturePluginSyncRefresh({ projectDir: workspace.root, harnessDir: ".claude", policy })).toEqual({ kind: "refused", message: "The selected refresh policy cannot establish compatibility: .claude/tools/aidlc-lib.ts is missing or not a regular file. Review the change before refreshing this open work." });
});

test("a retained original capture refuses work changed before a busy retry replans", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  expect(original.inputs.workspace.open).toEqual([{ workflow: "default/open", currentStage: "work" }]);
  workspace.write(statePath, "# Synthetic state fixture\n- **Status**: Running\n- **Current Stage**: changed-work\n");
  expect(applySelectedPluginSyncRefresh({ refresh: original, plan: payloadPlan({ workspace }), existing: {} })).toEqual({ kind: "refused", message: "The selected refresh policy cannot establish compatibility: workflow or rule inputs changed while preparing the payload. Review the change before refreshing this open work." });
  expect(workspace.read(".claude/tools/payload.ts")).toBe("before\n");
});

test("an unreviewed compiled contract change is refused instead of becoming a successful sync", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  expect(original.inputs.workspace.open).toEqual([{ workflow: "default/open", currentStage: "work" }]);
  const plan: TransactionPlan = { schemaVersion: 1, root: workspace.root, operations: [writeOperation(graphPath, unreviewedGraph, transactionState(workspace.path(graphPath)))] };
  expect(applySelectedPluginSyncRefresh({ refresh: original, plan, existing: {} })).toEqual({ kind: "refused", message: 'The selected refresh policy cannot establish compatibility: stage "work" changes outside the selected policy. Review the change before refreshing this open work.' });
  expect(workspace.read(graphPath)).toBe(installedGraph);
});

test("an empty plan runs existing and policy guards once in order under the default audit lock", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  expect(original.inputs.workspace.open).toEqual([{ workflow: "default/open", currentStage: "work" }]);
  const guard = mock<(input: { readonly phase: string; readonly candidateRoot?: string }) => boolean>(() => holdsAuditLock(workspace.root));
  const operations = createPluginSyncRefreshApplyOperations();
  const execute = mock(operations.execute);
  const existing = { validateLocked: () => { guard({ phase: "existing-locked" }); }, validateCandidates: (candidateRoot: string) => { guard({ phase: "existing-candidates", candidateRoot }); }, validateCommitted: () => { guard({ phase: "existing-committed" }); } };
  const outcome = applySelectedPluginSyncRefresh({ refresh: original, plan: { schemaVersion: 1, root: workspace.root, operations: [] }, existing, operations: { ...operations, execute, plan: (input) => {
    const review = operations.plan(input);
    return { ...review, checks: {
      validateLocked: () => { guard({ phase: "policy-locked" }); review.checks.validateLocked(); },
      validateCandidates: (candidateRoot) => { guard({ phase: "policy-candidates", candidateRoot }); review.checks.validateCandidates(candidateRoot); },
      validateCommitted: () => { guard({ phase: "policy-committed" }); review.checks.validateCommitted(); },
    } };
  } } });
  expect(outcome.kind).toBe("ready");
  expect(guard.mock.calls).toEqual([[{ phase: "existing-locked" }], [{ phase: "policy-locked" }], [{ phase: "existing-candidates", candidateRoot: workspace.root }], [{ phase: "policy-candidates", candidateRoot: workspace.root }], [{ phase: "existing-committed" }], [{ phase: "policy-committed" }]]);
  expect(guard.mock.results).toEqual([{ type: "return", value: true }, { type: "return", value: true }, { type: "return", value: true }, { type: "return", value: true }, { type: "return", value: true }, { type: "return", value: true }]);
  expect(execute).not.toHaveBeenCalled();
  expect(holdsAuditLock(workspace.root)).toBe(false);
});

test("an existing empty-plan guard refusal stops later guards without executing a transaction", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  const guard = mock<(input: { readonly phase: string }) => void>(() => undefined);
  const operations = createPluginSyncRefreshApplyOperations();
  const execute = mock(operations.execute);
  const existing = { validateLocked: () => { guard({ phase: "existing-locked" }); validateTransactionPlan({ schemaVersion: 1, root: workspace.root, operations: [{ kind: "remove", path: "../escape", expected: "absent" }] }); }, validateCandidates: () => { guard({ phase: "existing-candidates" }); }, validateCommitted: () => { guard({ phase: "existing-committed" }); } };
  const outcome = applySelectedPluginSyncRefresh({ refresh: original, plan: { schemaVersion: 1, root: workspace.root, operations: [] }, existing, operations: { ...operations, execute, plan: (input) => {
    const review = operations.plan(input);
    return { ...review, checks: { validateLocked: () => { guard({ phase: "policy-locked" }); review.checks.validateLocked(); }, validateCandidates: review.checks.validateCandidates, validateCommitted: review.checks.validateCommitted } };
  } } });
  expect(outcome).toEqual({ kind: "refused", message: "transaction path escapes root: ../escape" });
  expect(guard.mock.calls).toEqual([[{ phase: "existing-locked" }]]);
  expect(execute).not.toHaveBeenCalled();
  expect(holdsAuditLock(workspace.root)).toBe(false);
  expect(workspace.read(graphPath)).toBe(installedGraph);
});

test("selected planning and actual commit share config/state's default audit identity", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  expect(original.inputs.workspace.open).toEqual([{ workflow: "default/open", currentStage: "work" }]);
  const lockProbe = mock<(input: { readonly phase: string }) => boolean>(() => holdsAuditLock(workspace.root));
  const operations = createPluginSyncRefreshApplyOperations();
  const outcome = applySelectedPluginSyncRefresh({ refresh: original, plan: payloadPlan({ workspace }), existing: {}, operations: { ...operations, plan: (input) => { lockProbe({ phase: "plan" }); return operations.plan(input); }, execute: ({ plan, options }) => { lockProbe({ phase: "execute" }); executePlan(plan, options); } } });
  expect(outcome.kind).toBe("ready");
  expect(lockProbe.mock.calls).toEqual([[{ phase: "plan" }], [{ phase: "execute" }]]);
  expect(lockProbe.mock.results).toEqual([{ type: "return", value: true }, { type: "return", value: true }]);
  expect(holdsAuditLock(workspace.root)).toBe(false);
  expect(workspace.read(".claude/tools/payload.ts")).toBe("after\n");
});

test("the native transaction still rolls back when existing failAfter interrupts the policy plan", () => {
  using workspace = createDefaultFixtureWorkspace();
  populate({ workspace });
  const original = capture({ workspace });
  expect(original.inputs.workspace.open).toEqual([{ workflow: "default/open", currentStage: "work" }]);
  const plan = payloadPlan({ workspace });
  expect(applySelectedPluginSyncRefresh({ refresh: original, plan, existing: { failAfter: 1 } })).toEqual({ kind: "refused", message: "injected transaction failure after operation 1" });
  expect(workspace.read(".claude/tools/payload.ts")).toBe("before\n");
  expect(workspace.read(statePath)).toBe("# Synthetic state fixture\n- **Status**: Running\n- **Current Stage**: work\n");
});
