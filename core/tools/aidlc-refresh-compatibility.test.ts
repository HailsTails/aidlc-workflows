import { ok as assert } from "node:assert";
import { expect, test } from "bun:test";
import { planCompatibleRefresh, refreshRevalidationNotes, type RefreshMetadataReader } from "./aidlc-refresh-compatibility.ts";
import type { TransactionPlan } from "./aidlc-transaction.ts";

const fixture = () => {
  const state = 'export const CURRENT_STATE_VERSION = "8";';
  const graph = '[{"slug":"work","mode":"inline"}]';
  const scopes = '{"feature":{"stages":{"work":"EXECUTE"}}}';
  const files: Record<string, string> = {
    "/project/.claude/tools/aidlc-lib.ts": state,
    "/source/.claude/tools/aidlc-lib.ts": state,
    "/project/.claude/tools/data/stage-graph.json": graph,
    "/source/.claude/tools/data/stage-graph.json": graph,
    "/project/.claude/tools/data/scope-grid.json": scopes,
    "/source/.claude/tools/data/scope-grid.json": scopes,
  };
  const reader: RefreshMetadataReader = {
    read: ({ root, path }) => {
      const content = files[[root, path].join("/")];
      if (content === undefined) {
        return { kind: "refused", reason: "metadata-unreadable", message: "fixture metadata unavailable" };
      }
      return { kind: "read", content, hash: content };
    },
  };
  const plan: TransactionPlan = { schemaVersion: 1, root: "/project", operations: [] };
  return {
    args: { projectDir: "/project", sourceRoot: "/source", harnessDir: ".claude", plan, reader,
      compareStages: ({ installed, candidate }: { readonly installed: unknown; readonly candidate: unknown }) =>
        ({ kind: "comparable" as const, installed: { contract: installed },
          candidate: { contract: candidate }, revalidation: [] }),
    },
    set: ({ path, content }: { path: string; content: string }) => { files[path] = content; },
  };
};

test("unchanged metadata produces an explicit planned result and locked validation", () => {
  const f = fixture();
  const result = planCompatibleRefresh(f.args);
  assert(result.kind === "planned");
  expect(result.evidence).toMatchObject({ stateVersion: "8", stages: 1, scopes: 1 });
  expect(result.validateLocked()).toEqual({ kind: "validated" });
});

test.each([
  ["/source/.claude/tools/aidlc-lib.ts", "unestablished", "state-schema-unestablished"],
  ["/source/.claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "9";', "state-schema-changed"],
  ["/source/.claude/tools/data/stage-graph.json", "{ broken", "metadata-invalid"],
  ["/source/.claude/tools/data/stage-graph.json", "{}", "metadata-invalid"],
  ["/source/.claude/tools/data/stage-graph.json", "[]", "metadata-invalid"],
  ["/source/.claude/tools/data/stage-graph.json", '[{"slug":"work"},{"slug":"work"}]', "metadata-invalid"],
  ["/source/.claude/tools/data/stage-graph.json", '[{"slug":"other"}]', "stage-contract-changed"],
  ["/source/.claude/tools/data/scope-grid.json", "{}", "metadata-invalid"],
  ["/source/.claude/tools/data/scope-grid.json", '{"other":{}}', "scope-contract-changed"],
] as const)("incompatible metadata at %s returns %s", (path, content, reason) => {
  const f = fixture();
  f.set({ path, content });
  expect(planCompatibleRefresh(f.args)).toMatchObject({ kind: "refused", reason });
});

test("a reader refusal is returned as operational data", () => {
  const f = fixture();
  expect(planCompatibleRefresh({
    ...f.args,
    reader: { read: () => ({ kind: "refused", reason: "metadata-unreadable", message: "fixture read refused" }) },
  })).toEqual({ kind: "refused", reason: "metadata-unreadable", message: "fixture read refused" });
});

test("a changed source after planning refuses locked validation", () => {
  const f = fixture();
  const result = planCompatibleRefresh(f.args);
  assert(result.kind === "planned");
  f.set({ path: "/source/.claude/tools/data/scope-grid.json", content: '{"feature":{"stages":{"work":"EXECUTE"}},"other":{}}' });
  expect(result.validateLocked()).toMatchObject({ kind: "refused", reason: "inputs-changed" });
});

test("names each accepted effect in one note that says what follows from it", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "code-generation": ["plan-approval-questions"],
    "rin-gate-1-framing": ["framing-decision-record"],
    work: ["gate-sensor-coverage", "plan-approval-questions"],
  }, openWorkflows: [
    { workflow: "default/elsewhere", currentStage: "requirements-analysis" },
    { workflow: "other/no-state", currentStage: null },
  ] })).toEqual([
    'Open-workflow refresh accepts the engine-written questions declaration for stage "code-generation" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts.',
    'Open-workflow refresh accepts the reviewed #67 prose change for stage "rin-gate-1-framing" (framing-decision-record): no open workflow records Gate 1 as its current stage, so none has questions to answer before resuming.',
    'Open-workflow refresh accepts wider advisory gate sensor coverage for stage "work" (gate-sensor-coverage): the next gate check reads the added paths.',
    'Open-workflow refresh accepts the engine-written questions declaration for stage "work" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts.',
  ]);
  expect(refreshRevalidationNotes({ stageRevalidation: {}, openWorkflows: [] })).toEqual([]);
});

test("names the open workflows at an accepted stage, leading Gate 1 with the answers they owe", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "code-generation": ["plan-approval-questions"],
    "rin-gate-1-framing": ["framing-decision-record"],
  }, openWorkflows: [
    { workflow: "default/framing", currentStage: "rin-gate-1-framing" },
    { workflow: "default/building", currentStage: "code-generation" },
    { workflow: "other/parked-framing", currentStage: "rin-gate-1-framing" },
    { workflow: "other/unknown", currentStage: null },
  ] })).toEqual([
    'Open-workflow refresh accepts the engine-written questions declaration for stage "code-generation" (plan-approval-questions): Plan Approval rechecks a retained code-generation-questions.md before its answer counts. Open at this stage: default/building.',
    'Open-workflow refresh accepts the reviewed #67 prose change for stage "rin-gate-1-framing" (framing-decision-record): answer the open Gate 1 questions in default/framing, other/parked-framing before resuming; nothing rechecks them, and a blank [Answer]: waits for the person only until it is filled or removed, and never under autonomous mode (guide 18, Refresh Safety).',
  ]);
});

test("an unrelated transaction root is refused before metadata reads", () => {
  const f = fixture();
  expect(planCompatibleRefresh({ ...f.args, plan: { ...f.args.plan, root: "/elsewhere" } }))
    .toMatchObject({ kind: "refused", reason: "transaction-root-invalid" });
});
