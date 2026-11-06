// covers: file:core/tools/aidlc-workflow-refresh-contract.ts, file:core/tools/aidlc-refresh-resulting-view.ts
import { expect, test } from "bun:test";
import { assessWorkflowRefresh, sameContractValue, type WorkflowContractSnapshot } from "../../core/tools/aidlc-workflow-refresh-contract.ts";
import { stageRefreshComparison } from "../../core/tools/aidlc-stage-refresh-contract.ts";
import { mutatesWorkflowWorkspace, refreshOperationsOverlap, resultingFile } from "../../core/tools/aidlc-refresh-resulting-view.ts";
import { writeOperation } from "../../core/tools/aidlc-transaction.ts";
import "../../core/tools/aidlc-stage-refresh-contract.test.ts";

const contract: WorkflowContractSnapshot = { stateVersion: "8", stages: { work: { slug: "work", approval_mode: "explicit" } }, scopes: { feature: { stages: { work: "EXECUTE" } } } };
const assess = (candidate: WorkflowContractSnapshot) => assessWorkflowRefresh({ installed: contract, candidate, openWorkflows: [{ workflow: "default/open", currentStage: "work" }], compareStages: stageRefreshComparison });
test("workflow comparison preserves unknown contract fields and scope membership", () => {
  expect(assess(contract).kind).toBe("compatible");
  expect(assess({ ...contract, stateVersion: "9" })).toEqual({ kind: "unproved", contract: "state-schema" });
  expect(assess({ ...contract, stages: { work: { ...contract.stages.work, future_obligation: true } } })).toEqual({ kind: "unproved", contract: "stage", name: "work" });
  expect(assess({ ...contract, scopes: {} })).toEqual({ kind: "unproved", contract: "scope", name: "feature" });
});
test("work with no open obligations does not acquire a compatibility gate", () => {
  expect(assessWorkflowRefresh({ installed: contract, candidate: { ...contract, stateVersion: "9", stages: {}, scopes: {} }, openWorkflows: [], compareStages: stageRefreshComparison })).toEqual({ kind: "compatible", stageRevalidation: {} });
});
test("contract equality ignores object key order but keeps array order and missing fields", () => {
  expect(sameContractValue({ a: [1,2], b: {} }, { b: {}, a: [1,2] })).toBe(true);
  expect(sameContractValue([1,2], [2,1])).toBe(false);
  expect(sameContractValue({ a: undefined }, {})).toBe(false);
});
test("resulting views distinguish retained, replaced trees, removal and ambiguity", () => {
  const path = ".claude/tools/data/stage-graph.json";
  expect(resultingFile({ path, operations: [], caseInsensitive: false })).toEqual({ kind: "retained" });
  const tree = { kind: "tree", path: ".claude/tools", source: "/source", sourceHash: "fixture" } as const;
  expect(resultingFile({ path, operations: [tree], caseInsensitive: false })).toEqual({ kind: "operation", operation: tree, suffix: "data/stage-graph.json" });
  const remove = { kind: "remove", path: ".claude" } as const;
  expect(resultingFile({ path, operations: [remove], caseInsensitive: false })).toEqual({ kind: "operation", operation: remove, suffix: "tools/data/stage-graph.json" });
  expect(resultingFile({ path, operations: [tree, writeOperation(path, "[]")], caseInsensitive: false }).kind).toBe("unproved");
  expect(resultingFile({ path, operations: [writeOperation(`${path}/child`, "bad")], caseInsensitive: false }).kind).toBe("unproved");
});
test("Windows aliases cannot hide workflow writes or duplicate metadata operations", () => {
  expect(mutatesWorkflowWorkspace({ operations: [writeOperation(".\\AIDLC\\spaces\\default\\memory\\team.md", "changed")], caseInsensitive: true })).toBe(true);
  expect(mutatesWorkflowWorkspace({ operations: [{ kind: "remove", path: "aidlc" }], caseInsensitive: false })).toBe(true);
  expect(mutatesWorkflowWorkspace({ operations: [writeOperation("aidlc-extra/file", "ok")], caseInsensitive: false })).toBe(false);
  expect(resultingFile({ path: ".claude/tools/data/stage-graph.json", operations: [writeOperation(".CLAUDE/tools/data/STAGE-GRAPH.json", "one"), writeOperation(".claude/tools/data/stage-graph.json", "two")], caseInsensitive: true }).kind).toBe("unproved");
});

test("Windows operation collisions are refused even outside contract metadata", () => {
  const operations = [writeOperation(".claude/tools/payload.ts", "one"), writeOperation(".CLAUDE/TOOLS/PAYLOAD.ts", "two")];
  expect(refreshOperationsOverlap({ operations, caseInsensitive: true })).toBe(true);
  expect(refreshOperationsOverlap({ operations, caseInsensitive: false })).toBe(false);
});
