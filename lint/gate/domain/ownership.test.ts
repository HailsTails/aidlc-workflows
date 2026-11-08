import { describe, expect, test } from "bun:test";
import { globMatcher } from "./glob.ts";
import type { Lane, LanePlan } from "./lane-plan.ts";
import { claimFor, refusalFor } from "./ownership.ts";

const laneA: Lane = {
  id: "A",
  name: "Workflow Definition",
  owns: ["src/workflow-definition/**"],
  notOwned: ["src/workflow-definition/fixtures/**"],
  deletions: [{ pattern: "core/tools/aidlc-lib.ts", declarations: ["loadStageGraph"] }],
  hotFileGrants: [],
};

const laneG: Lane = {
  id: "G",
  name: "Guardrails",
  owns: ["eslint.config.ts", "lint/**"],
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
    expect(claimKind(laneA, "src/workflow-definition/domain/stage.ts")).toBe("owned");
  });

  test("notOwned carves a path out of the lane", () => {
    expect(claimKind(laneA, "src/workflow-definition/fixtures/method.fixture.ts")).toBe("foreign");
  });

  test("another lane's path is foreign", () => {
    expect(claimKind(laneA, "src/projection/domain/projection.ts")).toBe("foreign");
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
