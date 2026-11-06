// covers: file:core/tools/aidlc-workflow-refresh.ts, file:core/tools/aidlc-refresh-resulting-view.ts
import { expect, mock, test } from "bun:test";
import {
  createDefaultFixtureWorkspace,
  type FixtureWorkspace,
} from "../harness/fixture-workspace.ts";
import { sha256File } from "../../core/tools/aidlc-distribution.ts";
import { stageRefreshComparison } from "../../core/tools/aidlc-stage-refresh-contract.ts";
import { refreshRevalidationNotes } from "../../core/tools/aidlc-refresh-notes.ts";
import {
  captureWorkflowRefreshInputs,
  combineRefreshChecks,
  planWorkflowRefresh,
  validateEmptyRefreshPlan,
} from "../../core/tools/aidlc-workflow-refresh.ts";
import type { WorkflowRefreshPolicy } from "../../core/tools/aidlc-workflow-refresh-contract.ts";
import {
  executePlan,
  transactionSourceHash,
  transactionState,
  writeOperation,
  type TransactionPlan,
} from "../../core/tools/aidlc-transaction.ts";

const graph = ".claude/tools/data/stage-graph.json";
const stage = {
  slug: "work",
  approval_mode: "explicit",
  outputs: "result.md",
  sensors: [],
  sensors_applicable: [],
};
const policy: WorkflowRefreshPolicy = {
  id: "fixture-core-v1",
  compareStages: stageRefreshComparison,
  notes: (refreshContext) => refreshRevalidationNotes({ ...refreshContext, stageRevalidation: {} }),
};
type RefreshFixture = FixtureWorkspace & { readonly plan: TransactionPlan };
const fixture = (workspace: FixtureWorkspace): RefreshFixture => {
  workspace.write(".claude/tools/aidlc-lib.ts", 'export const CURRENT_STATE_VERSION = "8";\n');
  workspace.write(graph, JSON.stringify([stage]));
  workspace.write(
    ".claude/tools/data/scope-grid.json",
    JSON.stringify({ feature: { stages: { work: "EXECUTE" } } }),
  );
  workspace.write(".claude/tools/payload.ts", "original\n");
  workspace.write(
    "aidlc/spaces/default/intents/open/aidlc-state.md",
    "# State\n- **Status**: Running\n- **Current Stage**: work\n",
  );
  workspace.write(
    "aidlc/spaces/default/intents/open/audit.md",
    "Synthetic historical evidence, not an earned receipt.\r\n",
  );
  workspace.write("aidlc/spaces/default/memory/team.md", "# Private rule\r\n");
  const plan: TransactionPlan = {
    schemaVersion: 1,
    root: workspace.root,
    operations: [
      writeOperation(
        ".claude/tools/payload.ts",
        "updated\n",
        sha256File(workspace.path(".claude/tools/payload.ts")),
      ),
    ],
  };
  return { ...workspace, plan };
};
const prepare = (f: RefreshFixture) =>
  planWorkflowRefresh({ projectDir: f.root, harnessDir: ".claude", plan: f.plan, policy });

test("actual current transaction uses retained metadata and preserves authoritative records", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const review = prepare(f);
  expect(review.evidence.openWorkflows).toEqual([
    { workflow: "default/open", currentStage: "work" },
  ]);
  executePlan(f.plan, review.checks);
  expect(f.read(".claude/tools/payload.ts")).toBe("updated\n");
  expect(f.read("aidlc/spaces/default/intents/open/audit.md")).toBe(
    "Synthetic historical evidence, not an earned receipt.\r\n",
  );
  expect(f.read("aidlc/spaces/default/memory/team.md")).toBe("# Private rule\r\n");
});
test("the comparison follows planned bytes, not a separate prepared-source assertion", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.plan.operations = [
    writeOperation(
      graph,
      JSON.stringify([{ ...stage, approval_mode: "implicit" }]),
      sha256File(f.path(graph)),
    ),
  ];
  expect(() => prepare(f)).toThrow("stage");
  expect(JSON.parse(f.read(graph))[0].approval_mode).toBe("explicit");
});
test("an ancestor tree replacement supplies the full resulting metadata", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const source = f.path("source-tools");
  f.copyFrom(f.path(".claude/tools"), f.relative(source));
  f.write("source-tools/payload.ts", "from tree\n");
  f.plan.operations = [
    {
      kind: "tree",
      path: ".claude/tools",
      source,
      sourceHash: transactionSourceHash(source),
      expected: transactionState(f.path(".claude/tools")),
    },
  ];
  executePlan(f.plan, prepare(f).checks);
  expect(f.read(".claude/tools/payload.ts")).toBe("from tree\n");
});
test("removed metadata never falls back to the installed file", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.plan.operations = [
    {
      kind: "remove",
      path: ".claude/tools/data",
      expected: transactionState(f.path(".claude/tools/data")),
    },
  ];
  expect(() => prepare(f)).toThrow("removed");
});
test("inputs captured before preparation reject later private-rule changes", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const inputs = captureWorkflowRefreshInputs(f.root, ".claude");
  f.write("aidlc/spaces/default/memory/team.md", "# Changed after compilation\n");
  expect(() =>
    planWorkflowRefresh({
      projectDir: f.root,
      harnessDir: ".claude",
      plan: f.plan,
      policy,
      inputs,
    }),
  ).toThrow("while preparing");
});
test.each([
  "aidlc/spaces/default/memory/team.md",
  "aidlc/spaces/default/intents/open/aidlc-state.md",
  graph,
])("changed %s refuses under the existing transaction lock", (path) => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const review = prepare(f);
  f.write(path, `${f.read(path)}\n`);
  expect(() => executePlan(f.plan, review.checks)).toThrow("changed");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test("staged metadata is verified before any payload commits", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.plan.operations = [
    ...f.plan.operations,
    writeOperation(graph, JSON.stringify([stage], null, 2), sha256File(f.path(graph))),
  ];
  const review = prepare(f);
  const checks = combineRefreshChecks(
    {
      validateCandidates: (root) =>
        f.write(
          `${f.relative(root)}/${graph}`,
          JSON.stringify([{ ...stage, outputs: "different.md" }]),
        ),
    },
    review.checks,
  );
  expect(() => executePlan(f.plan, checks)).toThrow("staged metadata differs");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test("committed checks compose and a rejected commit rolls back", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const review = prepare(f);
  const locked = mock();
  const candidates = mock();
  const committed = mock(() => expect.unreachable("existing hook check refused"));
  const checks = combineRefreshChecks(review.checks, {
    validateLocked: locked,
    validateCandidates: candidates,
    validateCommitted: committed,
  });
  expect(() => executePlan(f.plan, checks)).toThrow("existing hook check refused");
  expect(locked).toHaveBeenCalledTimes(1);
  expect(candidates).toHaveBeenCalledTimes(1);
  expect(committed).toHaveBeenCalledTimes(1);
  expect(locked.mock.invocationCallOrder[0]).toBeLessThan(candidates.mock.invocationCallOrder[0]);
  expect(candidates.mock.invocationCallOrder[0]).toBeLessThan(
    committed.mock.invocationCallOrder[0],
  );
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test("an explicit empty refresh validates all phases and detects stale inputs", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.plan.operations = [];
  const review = prepare(f);
  const locked = mock();
  const candidates = mock();
  const committed = mock();
  validateEmptyRefreshPlan(
    f.plan,
    combineRefreshChecks(review.checks, {
      validateLocked: locked,
      validateCandidates: candidates,
      validateCommitted: committed,
    }),
  );
  expect(locked).toHaveBeenCalledTimes(1);
  expect(candidates).toHaveBeenCalledTimes(1);
  expect(committed).toHaveBeenCalledTimes(1);
  expect(locked.mock.invocationCallOrder[0]).toBeLessThan(candidates.mock.invocationCallOrder[0]);
  expect(candidates.mock.invocationCallOrder[0]).toBeLessThan(
    committed.mock.invocationCallOrder[0],
  );
  f.write("aidlc/spaces/default/memory/team.md", "changed");
  expect(() => validateEmptyRefreshPlan(f.plan, review.checks)).toThrow("changed");
});
test("malformed ownership and direct workspace mutation are not compatibility evidence", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write("aidlc/spaces/default/intents/intents.json", "{ broken");
  expect(() => prepare(f)).toThrow("readable work list");
  f.write("aidlc/spaces/default/intents/intents.json", "[]");
  f.plan.operations = [writeOperation("aidlc/spaces/default/intents/open/audit.md", "replacement")];
  expect(() => prepare(f)).toThrow("workflow records");
});

test("the transaction root cannot substitute another checkout", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  using otherWorkspace = createDefaultFixtureWorkspace();
  const other = fixture(otherWorkspace);
  expect(() =>
    planWorkflowRefresh({ projectDir: f.root, harnessDir: ".claude", plan: other.plan, policy }),
  ).toThrow("different project");
});
test("unrelated regular files in the spaces directory are not workflow records", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write("aidlc/spaces/.keep", "ignored directory marker");
  expect(prepare(f).evidence.openWorkflows).toHaveLength(1);
});
const scopeChanges: readonly (readonly [string, (workspace: FixtureWorkspace) => void])[] = [
  [
    "modify",
    (workspace) => workspace.write("aidlc/scopes/composed.json", "changed authoritative scope\n"),
  ],
  [
    "add",
    (workspace) => workspace.write("aidlc/scopes/extra.json", "changed authoritative scope\n"),
  ],
  ["remove", (workspace) => workspace.remove("aidlc/scopes/composed.json")],
];

test.each(
  scopeChanges,
)("composed scope %s is checked before preparation", (_change, mutateScope) => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write("aidlc/scopes/composed.json", "original authoritative scope\n");
  const inputs = captureWorkflowRefreshInputs(f.root, ".claude");
  mutateScope(f);
  expect(() =>
    planWorkflowRefresh({
      projectDir: f.root,
      harnessDir: ".claude",
      plan: f.plan,
      policy,
      inputs,
    }),
  ).toThrow("while preparing");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test.each(scopeChanges)("composed scope %s is checked under lock", (_change, mutateScope) => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write("aidlc/scopes/composed.json", "original authoritative scope\n");
  const review = prepare(f);
  mutateScope(f);
  expect(() => executePlan(f.plan, review.checks)).toThrow("changed");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test.each(scopeChanges)("composed scope %s is checked during staging", (_change, mutateScope) => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write("aidlc/scopes/composed.json", "original authoritative scope\n");
  const review = prepare(f);
  const checks = combineRefreshChecks({ validateCandidates: () => mutateScope(f) }, review.checks);
  expect(() => executePlan(f.plan, checks)).toThrow("changed");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test("an ancestor replacement with missing metadata cannot reuse the installed copy", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const source = f.path("missing-tools");
  f.copyFrom(f.path(".claude/tools"), f.relative(source));
  f.remove("missing-tools/data/stage-graph.json");
  f.plan.operations = [
    {
      kind: "tree",
      path: ".claude/tools",
      source,
      sourceHash: transactionSourceHash(source),
      expected: transactionState(f.path(".claude/tools")),
    },
  ];
  expect(() => prepare(f)).toThrow("missing or not a regular file");
});
// Windows resolves alternate case to the same file; other hosts use its authored name.
const metadataDestination = {
  win32: ".CLAUDE/TOOLS/DATA/STAGE-GRAPH.JSON",
  aix: graph,
  android: graph,
  darwin: graph,
  freebsd: graph,
  haiku: graph,
  linux: graph,
  openbsd: graph,
  sunos: graph,
  cygwin: graph,
  netbsd: graph,
}[process.platform];

test("actual filesystem destinations, including mixed case on Windows, replace installed metadata", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.plan.operations = [
    writeOperation(
      metadataDestination,
      JSON.stringify([{ ...stage, approval_mode: "implicit" }]),
      sha256File(f.path(graph)),
    ),
  ];
  expect(() => prepare(f)).toThrow("changes outside the selected policy");
  f.plan.operations = [
    writeOperation(
      metadataDestination,
      JSON.stringify([stage], null, 2),
      sha256File(f.path(graph)),
    ),
  ];
  executePlan(f.plan, prepare(f).checks);
  expect(f.read(graph)).toBe(JSON.stringify([stage], null, 2));
});
test("committed metadata tampering is detected without overwriting a concurrent edit", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const review = prepare(f);
  const edited = JSON.stringify([{ ...stage, outputs: "external.md" }]);
  const checks = combineRefreshChecks(
    { validateCommitted: () => f.write(graph, edited) },
    review.checks,
  );
  expect(() => executePlan(f.plan, checks)).toThrow("installed metadata differs");
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
  expect(f.read(graph)).toBe(edited);
});

test("redirected metadata directories refuse without reading through a junction", () => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  const original = f.path(".claude/tools/data");
  const target = f.path("external-data");
  f.copyFrom(original, f.relative(target));
  f.remove(".claude/tools/data");
  f.redirectDirectory(".claude/tools/data", "external-data");
  expect(() => prepare(f)).toThrow();
  expect(f.read(".claude/tools/payload.ts")).toBe("original\n");
});
test.each([
  "Parked",
  "Blocked",
  "unknown-status",
])("%s work retains the selected contract obligation", (status) => {
  using workspace = createDefaultFixtureWorkspace();
  const f = fixture(workspace);
  f.write(
    "aidlc/spaces/default/intents/open/aidlc-state.md",
    `# State\n- **Status**: ${status}\n- **Current Stage**: work\n`,
  );
  expect(prepare(f).evidence.openWorkflows).toHaveLength(1);
  f.plan.operations = [
    writeOperation(
      graph,
      JSON.stringify([{ ...stage, approval_mode: "implicit" }]),
      sha256File(f.path(graph)),
    ),
  ];
  expect(() => prepare(f)).toThrow("stage");
});
