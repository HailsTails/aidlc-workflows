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

test("names each revalidation entry in one human-readable note", () => {
  expect(refreshRevalidationNotes({ stageRevalidation: {
    "code-generation": ["plan-approval-questions"],
    "rin-gate-1-framing": ["framing-decision-record"],
    work: ["gate-sensor-coverage", "plan-approval-questions"],
  } })).toEqual([
    'Open-workflow refresh revalidates stage "code-generation" (plan-approval-questions): the engine now writes code-generation-questions.md, and Plan Approval rechecks a retained question before it counts.',
    'Open-workflow refresh revalidates stage "rin-gate-1-framing" (framing-decision-record): Gate 1 now settles the decision-questions it can source and asks only reserved decisions; while an [Answer]: in an open rin-framing-questions.md is blank, the Stop hook holds the turn for the person unless Construction Autonomy Mode is autonomous; filling or removing it ends that, and the new Gate 1 prose may lead the agent to do either, so answer open Gate 1 questions before resuming.',
    'Open-workflow refresh revalidates stage "work" (gate-sensor-coverage): its advisory gate sensor now covers more paths, and the next gate check reads them.',
    'Open-workflow refresh revalidates stage "work" (plan-approval-questions): the engine now writes code-generation-questions.md, and Plan Approval rechecks a retained question before it counts.',
  ]);
  expect(refreshRevalidationNotes({ stageRevalidation: {} })).toEqual([]);
});

test("an unrelated transaction root is refused before metadata reads", () => {
  const f = fixture();
  expect(planCompatibleRefresh({ ...f.args, plan: { ...f.args.plan, root: "/elsewhere" } }))
    .toMatchObject({ kind: "refused", reason: "transaction-root-invalid" });
});
