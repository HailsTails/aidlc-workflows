import { describe, expect, test } from "bun:test";
import { judgeCallerMove, lineChanges } from "./caller-move.ts";
import { globMatcher } from "./glob.ts";
import type { Lane, LanePlan } from "./lane-plan.ts";
import { claimFor, refusalFor } from "./ownership.ts";

const laneA: Lane = {
  id: "A",
  name: "Workflow Definition",
  owns: ["src/workflow-definition/**"],
  territory: ["core/tools/aidlc-graph.ts"],
  notOwned: ["src/workflow-definition/fixtures/**"],
  deletions: [{ pattern: "core/tools/aidlc-lib.ts", declarations: ["loadStageGraph"] }],
  hotFileGrants: [],
};

const laneG: Lane = {
  id: "G",
  name: "Guardrails",
  owns: ["eslint.config.ts", "lint/**"],
  territory: [],
  notOwned: ["lint/context-map.ts"],
  deletions: [],
  hotFileGrants: [{ path: "package.json", keyPaths: ["devDependencies"] }],
};

const plan: LanePlan = {
  hotFiles: [
    "core/tools/aidlc-lib.ts",
    "package.json",
    "eslint.config.ts",
    "harness/*/manifest.ts",
  ],
  contracts: [{ writer: "0", files: ["src/workflow-definition/domain/{stage,method}.ts"] }],
  lanes: [laneA, laneG],
};

const shared = { records: ["lint/boundary-baseline.json", "tests/ratchets/**"] };

const claimKind = (lane: Lane, path: string): string =>
  claimFor({ plan, lane, path }, shared).kind;

describe("globMatcher", () => {
  test.each([
    ["src/**", "src/a/b.ts", true],
    ["src/**", "src", true],
    ["harness/*/manifest.ts", "harness/claude/manifest.ts", true],
    ["harness/*/manifest.ts", "harness/claude/x/manifest.ts", false],
    ["src/{a,b}/x.ts", "src/b/x.ts", true],
    ["**/*.test.ts", "lint/gate/domain/x.test.ts", true],
    ["lint/*.ts", "lint/gate/x.ts", false],
  ] as const)("%s matches %s: %p", (glob, path, expected) => {
    expect(globMatcher([glob])(path)).toBe(expected);
  });
});

describe("claimFor", () => {
  test("a lane owns files under its globs", () => {
    expect(claimKind(laneA, "src/workflow-definition/domain/stage-entry.ts")).toBe("owned");
  });

  test("a lane owns the legacy files of its territory", () => {
    expect(claimKind(laneA, "core/tools/aidlc-graph.ts")).toBe("owned");
  });

  test("a contract file is refused to every lane but its writer", () => {
    expect(claimKind(laneA, "src/workflow-definition/domain/method.ts")).toBe("contract-refused");
  });

  test("notOwned carves a path out of the lane", () => {
    expect(claimKind(laneA, "src/workflow-definition/fixtures/method.fixture.ts")).toBe("foreign");
  });

  test("another lane's src path is foreign", () => {
    expect(claimKind(laneA, "src/projection/domain/projection.ts")).toBe("foreign");
  });

  test("a legacy path outside the lane is a caller move", () => {
    expect(claimKind(laneA, "core/tools/aidlc-orchestrate-view.ts")).toBe("caller-move");
  });

  test("a hot file with a deletion grant is a deletion claim", () => {
    expect(claimKind(laneA, "core/tools/aidlc-lib.ts")).toBe("deletion");
  });

  test("a hot file with a key grant is a hot-grant claim", () => {
    expect(claimKind(laneG, "package.json")).toBe("hot-grant");
  });

  test("a hot file listed exactly in owns is owned", () => {
    expect(claimKind(laneG, "eslint.config.ts")).toBe("owned");
  });

  test("a hot file without a grant is refused even inside the lane's globs", () => {
    const laneB: Lane = { ...laneA, id: "B", owns: ["harness/*/**"], deletions: [] };
    expect(claimKind(laneB, "harness/claude/manifest.ts")).toBe("hot-refused");
  });

  test("ratchet records are shared by every lane", () => {
    expect(claimKind(laneA, "tests/ratchets/monolith-lines.json")).toBe("shared-record");
  });

  test("a refusal names the correct approach", () => {
    const request = { plan, lane: laneA, path: "src/cli/main.ts" };
    const refusal = refusalFor(request, claimFor(request, shared));
    expect(refusal?.fix).toContain("published domain types or a port");
  });
});

describe("judgeCallerMove", () => {
  const movedNames = new Set(["loadStageGraph"]);
  const before = [
    'import { loadStageGraph, readState } from "./aidlc-lib.ts";',
    "const graph = loadStageGraph(root);",
    "const answer = 41;",
  ].join("\n");

  const judge = (after: string) =>
    judgeCallerMove({
      path: "core/tools/aidlc-orchestrate.ts",
      lines: lineChanges({ before, after }),
      movedNames,
    });

  test("repointing the import and call site passes", () => {
    const after = [
      'import { readState } from "./aidlc-lib.ts";',
      'import { loadStageGraph } from "../../src/workflow-definition/main.ts";',
      "const graph = loadStageGraph(root);",
      "const answer = 41;",
    ].join("\n");
    expect(judge(after)).toEqual([]);
  });

  test("any other edit is refused with the stray line", () => {
    const after = before.replace("41", "42");
    const [finding] = judge(after);
    expect(finding?.violation).toContain("const answer = 42;");
  });
});
