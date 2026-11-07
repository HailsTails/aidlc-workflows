import { expect, mock, test } from "bun:test";
import { assessDependencies, type DependencySource, type OwnershipDeclarations, type WorkflowState } from "./assessment.ts";

const workflow = { space: "remote", name: "active", displayName: "remote/active" };
const state: WorkflowState = {
  lifecycle: "other", scope: "feature", stages: [
    { name: "bootstrap", progress: "other", action: "execute" },
    { name: "scan", progress: "completed", action: "execute" },
    { name: "scan", progress: "skipped", action: "execute" },
    { name: "scan", progress: "other", action: "other" },
    { name: "unknown", progress: "other", action: "execute" },
    { name: "scan", progress: "other", action: "execute" },
    { name: "scan", progress: "other", action: "execute" },
  ],
};
const ownership: OwnershipDeclarations = {
  scopes: [{ name: "feature" }],
  stages: [
    { name: "bootstrap", phase: "initialization", plugin: "boot" },
    { name: "scan", phase: "other", plugin: "security" },
  ],
};

test("the owning assessment retains ordered duplicate requirements and authoritative availability", () => {
  const source: DependencySource = {
    ownership: () => ownership,
    visitWorkflows: (visit) => visit({ identity: workflow, lifecycle: "other", readState: () => state }),
  };
  expect(assessDependencies(source, new Set())).toEqual([
    { kind: "scope", plugin: "aidlc", workflow, scope: "feature" },
    { kind: "stage", plugin: "security", workflow, stage: "scan" },
    { kind: "stage", plugin: "security", workflow, stage: "scan" },
  ]);
  expect(assessDependencies(source, new Set(["aidlc", "security"]))).toEqual([]);
});

test("terminal registries and unnamed workflows never acquire state", () => {
  const readState = mock(() => state);
  const source: DependencySource = {
    ownership: () => ownership,
    visitWorkflows: (visit) => {
      visit({ identity: workflow, lifecycle: "completed", readState });
      visit({ identity: workflow, lifecycle: "archived", readState });
      visit({ identity: { ...workflow, name: null }, lifecycle: "other", readState });
      visit({ identity: { ...workflow, name: "" }, lifecycle: "other", readState });
    },
  };
  expect(assessDependencies(source, new Set())).toEqual([]);
  expect(readState).not.toHaveBeenCalled();
});

test("ownership precedes visiting and each eligible workflow is read once in visitation order", () => {
  const trace = mock((event: string) => event);
  const source: DependencySource = {
    ownership: () => { trace("ownership"); return ownership; },
    visitWorkflows: (visit) => {
      trace("visit");
      visit({ identity: { ...workflow, name: "missing" }, lifecycle: "other", readState: (name) => { trace(name); return null; } });
      visit({ identity: { ...workflow, name: "closed" }, lifecycle: "other", readState: (name) => { trace(name); return { ...state, lifecycle: "archived" }; } });
      visit({ identity: workflow, lifecycle: "other", readState: (name) => { trace(name); return state; } });
    },
  };
  expect(assessDependencies(source, new Set(["aidlc"]))).toEqual([
    { kind: "stage", plugin: "security", workflow, stage: "scan" },
    { kind: "stage", plugin: "security", workflow, stage: "scan" },
  ]);
  expect(trace.mock.calls).toEqual([["ownership"], ["visit"], ["missing"], ["closed"], ["active"]]);
});

test.each(["completed", "archived"] satisfies WorkflowState["lifecycle"][])("%s state imposes no requirement", (lifecycle) => {
  const source: DependencySource = {
    ownership: () => ownership,
    visitWorkflows: (visit) => visit({ identity: workflow, lifecycle: "other", readState: () => ({ ...state, lifecycle }) }),
  };
  expect(assessDependencies(source, new Set())).toEqual([]);
});

test("last declarations win while missing and empty scope ownership impose no constraint", () => {
  const source: DependencySource = {
    ownership: () => ({
      scopes: [{ name: "feature", plugin: "first" }, { name: "feature", plugin: "" }],
      stages: [
        { name: "scan", phase: "other", plugin: "first" },
        { name: "scan", phase: "other", plugin: "last" },
        { name: "scan", phase: "initialization", plugin: "boot" },
      ],
    }),
    visitWorkflows: (visit) => {
      visit({ identity: workflow, lifecycle: "other", readState: () => state });
      visit({ identity: workflow, lifecycle: "other", readState: () => ({ lifecycle: "other", scope: "unknown", stages: [] }) });
      visit({ identity: workflow, lifecycle: "other", readState: () => ({ lifecycle: "other", scope: null, stages: [] }) });
    },
  };
  expect(assessDependencies(source, new Set())).toEqual([
    { kind: "stage", plugin: "last", workflow, stage: "scan" },
    { kind: "stage", plugin: "last", workflow, stage: "scan" },
  ]);
});

test("source decoding errors escape unchanged in kind and stop later acquisition", () => {
  const laterRead = mock(() => state);
  const source: DependencySource = {
    ownership: () => ownership,
    visitWorkflows: (visit) => {
      visit({ identity: workflow, lifecycle: "other", readState: () => JSON.parse("unavailable state") });
      visit({ identity: workflow, lifecycle: "other", readState: laterRead });
    },
  };
  expect(() => assessDependencies(source, new Set())).toThrow(SyntaxError);
  expect(laterRead).not.toHaveBeenCalled();
});

test("ownership decoding failure occurs before workflow visitation", () => {
  const visitWorkflows = mock(() => undefined);
  const source: DependencySource = { ownership: () => JSON.parse("unavailable ownership"), visitWorkflows };
  expect(() => assessDependencies(source, new Set())).toThrow(SyntaxError);
  expect(visitWorkflows).not.toHaveBeenCalled();
});

test("sparse stage declarations and observations retain existing hole-skipping semantics", () => {
  const stages: OwnershipDeclarations["stages"][number][] = [];
  stages[1] = { name: "scan", phase: "other", plugin: "security" };
  const rows: WorkflowState["stages"][number][] = [];
  rows[2] = { name: "scan", progress: "other", action: "execute" };
  const source: DependencySource = {
    ownership: () => ({ scopes: [], stages }),
    visitWorkflows: (visit) => visit({ identity: workflow, lifecycle: "other", readState: () => ({ lifecycle: "other", scope: null, stages: rows }) }),
  };
  expect(assessDependencies(source, new Set())).toEqual([{ kind: "stage", plugin: "security", workflow, stage: "scan" }]);
});
