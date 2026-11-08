import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitRepository } from "./git-repository.ts";

setDefaultTimeout(30_000);

const SANDBOX = join(import.meta.dir, "../../../.cache/gate-tests", randomUUID());

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

type Project = { readonly root: string; readonly base: { ref: string; commit: string } };

const git = (root: string, ...args: readonly string[]): string => {
  const result = Bun.spawnSync(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  return result.stdout.toString().trim();
};

const write = (request: { root: string; path: string; content: string }): void => {
  const absolute = join(request.root, request.path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, request.content);
};

const commit = (request: { root: string; path: string; content: string }): void => {
  write(request);
  git(request.root, "add", "-A");
  git(request.root, "commit", "-q", "-m", `change ${request.path}`);
};

const projectBeforeMerge = (name: string): Project => {
  const root = join(SANDBOX, name);
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q", "-b", "foundation");
  git(root, "config", "user.email", "gate@example.com");
  git(root, "config", "user.name", "Gate");
  commit({ root, path: "core/tools/tool.ts", content: "export const v = 1;\n" });
  const base = { ref: "foundation", commit: git(root, "rev-parse", "HEAD") };
  git(root, "checkout", "-q", "-b", "upstream");
  commit({ root, path: "tests/unit/arrived.test.ts", content: "// arrived\n" });
  commit({ root, path: "core/tools/tool.ts", content: "export const v = 2;\n" });
  git(root, "checkout", "-q", "foundation");
  commit({ root, path: "src/own/own.ts", content: "export const own = 1;\n" });
  return { root, base };
};

const mergedProject = (name: string): Project => {
  const project = projectBeforeMerge(name);
  git(project.root, "merge", "-q", "--no-ff", "-m", "merge upstream", "upstream");
  return project;
};

describe("arrivals", () => {
  test("green: files that arrive byte-identical through a merge are arrivals", () => {
    const { root, base } = mergedProject("arrived");
    const arrivals = gitRepository(root).arrivals(base);
    expect(arrivals).toEqual(["core/tools/tool.ts", "tests/unit/arrived.test.ts"]);
  });

  test("red: a file a lane authored after the merge is not an arrival", () => {
    const { root, base } = mergedProject("lane-authored");
    commit({ root, path: "tests/unit/lane.test.ts", content: "// lane\n" });
    expect(gitRepository(root).arrivals(base)).not.toContain("tests/unit/lane.test.ts");
  });

  test("red: a lane module committed on the foundation side is not an arrival", () => {
    const { root, base } = mergedProject("foundation-side");
    expect(gitRepository(root).arrivals(base)).not.toContain("src/own/own.ts");
  });

  test("red: changed bytes on an upstream path, committed, are no longer an arrival", () => {
    const { root, base } = mergedProject("edited-committed");
    commit({ root, path: "tests/unit/arrived.test.ts", content: "// arrived, edited\n" });
    expect(gitRepository(root).arrivals(base)).not.toContain("tests/unit/arrived.test.ts");
  });

  test("red: changed bytes on an upstream path, uncommitted, are no longer an arrival", () => {
    const { root, base } = mergedProject("edited-uncommitted");
    write({ root, path: "core/tools/tool.ts", content: "export const v = 3;\n" });
    const arrivals = gitRepository(root).arrivals(base);
    expect(arrivals).toEqual(["tests/unit/arrived.test.ts"]);
  });

  test("red: a branch with no merge commit has no arrivals", () => {
    const { root, base } = projectBeforeMerge("no-merge");
    expect(gitRepository(root).arrivals(base)).toEqual([]);
  });
});
