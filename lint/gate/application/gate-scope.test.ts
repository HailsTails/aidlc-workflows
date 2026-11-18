import { describe, expect, test } from "bun:test";
import type { LanePlan } from "../domain/lane-plan.ts";
import type { ScopeRequest } from "./gate-request.ts";
import { scopeOf } from "./gate-scope.ts";
import type { Repository, Workspace } from "./ports.ts";

const PLAN: LanePlan = { hotFiles: [], contracts: [], lanes: [] };

const FILES_FOR: Readonly<Record<string, readonly string[]>> = {
  "src/kept.ts": ["src/kept.ts"],
  "src/dir/**": ["src/dir/a.ts"],
};

const WORKSPACE: Workspace = {
  read: () => undefined,
  write: () => undefined,
  filesMatching: (globs) => globs.flatMap((glob) => FILES_FOR[glob] ?? []),
};

const REPOSITORY = {} as Repository;

const requestFor = (target: string): ScopeRequest => ({
  kind: "scope",
  target,
  baseRef: "origin/rebuild/foundation",
  record: false,
  allTests: false,
  waitMs: 0,
  only: "all",
});

const SOURCES = { plan: PLAN, repository: REPOSITORY, workspace: WORKSPACE };

const changesOf = (target: string) => {
  const scope = scopeOf(SOURCES, requestFor(target));
  return scope.ok ? scope.value.changes : [];
};

describe("scopeOf with a list of paths", () => {
  test("a path that is still in the tree is a modified file", () => {
    expect(changesOf("src/kept.ts")).toEqual([{ path: "src/kept.ts", kind: "modified" }]);
  });

  test("a path that is gone from the tree is a deleted file", () => {
    expect(changesOf("src/gone.ts")).toEqual([{ path: "src/gone.ts", kind: "deleted" }]);
  });

  test("kept and gone paths in one list are each judged as what they are", () => {
    expect(changesOf("src/kept.ts,src/gone.ts")).toEqual([
      { path: "src/kept.ts", kind: "modified" },
      { path: "src/gone.ts", kind: "deleted" },
    ]);
  });

  test("a folder with files under it is not deleted", () => {
    expect(changesOf("src/dir")).toEqual([{ path: "src/dir/a.ts", kind: "modified" }]);
  });
});
