import { describe, expect, test } from "bun:test";
import type { Lane, LanePlan } from "../domain/lane-plan.ts";
import { scopeOf, fullScopeOf, scopeLaneId } from "./gate-scope.ts";
import { ownershipCheck } from "./ownership-check.ts";
import type { Repository } from "./ports.ts";

const lane = (id: string, owns: readonly string[]): Lane => ({
  id, name: id, owns, territory: [], notOwned: [], deletions: [], hotFileGrants: [],
});
const PLAN: LanePlan = {
  hotFiles: ["package.json"],
  contracts: [{ writer: "0", files: ["src/contracts.ts"] }],
  lanes: [lane("integration", ["src/app/**"]), lane("0", ["src/contracts.ts"]),
    lane("G", ["lint/**"])],
};
const REQUEST = {
  kind: "scope" as const, target: "integration+0+G", baseRef: "foundation",
  record: false, allTests: false, waitMs: 0, only: "all" as const,
};
const sources = (paths: readonly string[], plan = PLAN) => {
  const repository: Repository = {
    resolve: (ref) => ({ ref, commit: "base" }),
    changesSince: () => paths.map((path) => ({ path, kind: "modified" })),
    arrivals: () => [], readAt: () => "{}", listFiles: () => paths,
  };
  return { plan, repository, workspace: {
    read: () => '{"first":1,"second":1}', write: () => undefined, filesMatching: () => paths,
  } };
};
const judged = async (paths: readonly string[], target = REQUEST.target, plan = PLAN) => {
  const dependencies = sources(paths, plan);
  const scope = scopeOf(dependencies, { ...REQUEST, target });
  if (!scope.ok) {
    throw new Error(scope.problem);
  }
  return ownershipCheck({
    ...dependencies, sharedRecords: [], json: { parse: JSON.parse },
    modules: {
      shapeOf: () => ({ declarations: [], exports: [], statements: [] }),
      referencesOf: () => ({ imports: [], globals: [] }), membersOf: () => [],
    },
  }).run({ ...scope.value, heavy: { ensure: async () => ({ acquired: true }) } });
};

describe("declared joint ownership", () => {
  test("every path is accepted by its declared owner", async () => {
    const result = await judged(["src/app/main.ts", "src/contracts.ts", "lint/records.json"]);
    expect(result.status).toBe("green");
    expect(result.note).toContain("integration+0+G");
  });
  test("an undeclared contract owner does not contribute permission", async () => {
    expect((await judged(["src/contracts.ts"], "integration+G")).status).toBe("red");
  });
  test("a path none of the declared lanes owns stays red", async () => {
    expect((await judged(["src/foreign.ts"])).status).toBe("red");
  });
  test.each(["integration+missing", "missing+unknown", "integration+"])(
    "unknown or empty declared lane %s is refused", (target) => {
      expect(scopeOf(sources([]), { ...REQUEST, target }).ok).toBe(false);
    },
  );
  test("full mode resolves the same explicit lanes", () => {
    const result = fullScopeOf(sources([]), {
      ...REQUEST, kind: "full", laneId: REQUEST.target, build: false, sweep: false,
    });
    expect(result.ok).toBe(true);
    expect(result.ok ? scopeLaneId(result.value) : undefined).toBe(REQUEST.target);
  });
  test("two partial hot-file grants cannot combine into a wider permission", async () => {
    const plan = { ...PLAN, lanes: PLAN.lanes.map((value, index) => ({
      ...value,
      hotFileGrants: [{ path: "package.json", keyPaths: [index === 0 ? "first" : "second"] }],
    })) };
    expect((await judged(["package.json"], REQUEST.target, plan)).status).toBe("red");
  });
  test("one complete existing hot-file grant suffices", async () => {
    const plan = { ...PLAN, lanes: [...PLAN.lanes, {
      ...lane("package", []),
      hotFileGrants: [{ path: "package.json", keyPaths: ["first", "second"] }],
    }] };
    expect((await judged(["package.json"], "integration+package", plan)).status).toBe("green");
  });
  test("single-lane ownership remains enforced", async () => {
    expect((await judged(["src/app/main.ts"], "integration")).status).toBe("green");
    expect((await judged(["src/contracts.ts"], "integration")).status).toBe("red");
  });
});
