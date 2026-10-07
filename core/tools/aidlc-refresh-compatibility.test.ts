import { ok as assert } from "node:assert";
import { expect, test } from "bun:test";
import { planCompatibleRefresh, type RefreshMetadataReader } from "./aidlc-refresh-compatibility.ts";
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
    args: { projectDir: "/project", sourceRoot: "/source", harnessDir: ".claude", plan, reader },
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

test("an unrelated transaction root is refused before metadata reads", () => {
  const f = fixture();
  expect(planCompatibleRefresh({ ...f.args, plan: { ...f.args.plan, root: "/elsewhere" } }))
    .toMatchObject({ kind: "refused", reason: "transaction-root-invalid" });
});
