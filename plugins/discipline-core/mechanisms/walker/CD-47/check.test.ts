import ts from "typescript";
import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { TypeScriptWalkerCheck } from "../runner/typescript-parse.ts";
import { check } from "./check.ts";

type RepositoryCheck = Extract<TypeScriptWalkerCheck, { readonly kind: "repository" }>;
type Repository = Parameters<RepositoryCheck["inspect"]>[0]["repository"];

const inspect = (
  sources: Readonly<Record<string, string>>,
  settings: unknown = { module: "check.ts" },
) => {
  const files = Object.keys(sources).map((file) => repoPathSchema.parse(file));
  const repository: Repository = {
    syntaxApi: ts,
    files,
    trackedPaths: files,
    exists: ({ file }) => (file in sources ? "present" : "absent"),
    readText: ({ file }) => {
      const source = sources[file];
      return source === undefined
        ? { outcome: "failed", error: { kind: "file-unreadable", file, detail: "missing fixture" } }
        : { outcome: "ok", value: source };
    },
    parseFile: ({ file }) => {
      const source = sources[file];
      if (source === undefined)
        return {
          outcome: "failed",
          error: { kind: "file-unreadable", file, detail: "missing fixture" },
        };
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const nodes: ts.Node[] = [];
      const visit = (node: ts.Node): void => {
        nodes.push(node);
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(tree, visit);
      return { outcome: "ok", value: { source, tree, nodes } };
    },
  };
  return check.kind === "repository" ? check.inspect({ repository, settings }) : undefined;
};

const findings = (sources: Readonly<Record<string, string>>) => {
  const result = inspect(sources);
  return result?.outcome === "ok" ? result.value : undefined;
};

describe("CD-47 hermetic git subprocesses", () => {
  it("finds ambient spawns and retains JavaScript candidates", () => {
    expect(
      findings({
        "a.test.ts": 'const a = 1;\nspawnSync("git", ["init"]);',
        "b.test.mjs": 'execFileSync("git", []);',
        "c.test.js": 'execSync("git", []);',
        "d.spec.mjs": 'execa("git", []);',
      }),
    ).toHaveLength(4);
  });
  it("accepts the existing environment names within the eight-line span", () => {
    expect(
      inspect({
        "a.test.ts": 'execFileSync("git", ["init"], {\n env: repository.environment,\n});',
        "b.test.mjs": 'spawn("git", [], { env: hermeticGitEnvironment() });',
        "c.spec.ts": 'spawn("git", [], { env: withoutInheritedGitBindings() });',
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("retains the eight-line options span", () => {
    expect(
      findings({
        "a.test.ts":
          'spawn("git", [], {\n  a: 0,\n  b: 0,\n  c: 0,\n  d: 0,\n  e: 0,\n  f: 0,\n  g: 0,\n  env: repository.environment,\n});',
      }),
    ).toHaveLength(1);
  });
  it("flags ambient spreads even alongside a recognized environment", () => {
    expect(
      findings({
        "a.test.ts":
          'spawn("git", [], {\n env: { ...process.env },\n env: repository.environment,\n});',
      }),
    ).toHaveLength(1);
  });
  it("retains the original directory pruning and .claude coverage", () => {
    expect(
      findings({
        "node_modules/a.test.ts": 'spawn("git", []);',
        ".claude/worktrees/a.test.ts": 'spawn("git", []);',
        ".claude/hooks/a.test.ts": 'spawn("git", []);',
        "a.ts": 'spawn("git", []);',
      }),
    ).toHaveLength(1);
  });
  it("preserves reasoned existing allowances", () => {
    expect(
      inspect({
        "a.test.ts": 'spawn("git", []);',
        ".hermetic-git-allowances.json":
          '[{"file":"a.test.ts","reason":"existing reviewed fixture"}]',
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("reports stale allowances without granting new exemptions", () => {
    expect(
      inspect({
        "a.test.ts": "expect(1).toBe(1);",
        ".hermetic-git-allowances.json":
          '[{"file":"a.test.ts","reason":"existing reviewed fixture"}]',
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: ".hermetic-git-allowances.json",
          anchor: { line: 1, column: 0 },
          snippet:
            "[stale allowance] a.test.ts — suppresses nothing; delete the entry from .hermetic-git-allowances.json",
        },
      ],
    });
  });
  it("ignores malformed and unreasoned allowances", () => {
    expect(
      findings({
        "a.test.ts": 'spawn("git", []);',
        ".hermetic-git-allowances.json": '[{"file":"a.test.ts","reason":"  "}]',
      }),
    ).toHaveLength(1);
  });
  it("preserves the zero default floor and fails an explicit collapsed population", () => {
    expect(inspect({})).toEqual({ outcome: "ok", value: [] });
    expect(inspect({}, { module: "check.ts", minimumExpectedTestFiles: 1 })).toEqual({
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: "Hermetic-git guard: scanned 0 test file(s), expected at least 1.",
      },
    });
  });
  it("rejects invalid floor configuration", () => {
    expect(inspect({}, { minimumExpectedTestFiles: -1 })?.outcome).toBe("failed");
  });
  it("preserves literal-command matching gaps", () => {
    expect(inspect({ "a.test.ts": 'spawn(gitCommand, []); spawn("node", []);' })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
