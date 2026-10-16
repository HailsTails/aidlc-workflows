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

describe("CD-10 test throws", () => {
  it("finds a throw with its source location", () => {
    expect(inspect({ "src/a.test.ts": "const a = 1;\n  throw new Error('bad');" })).toEqual({
      outcome: "ok",
      value: [
        {
          file: "src/a.test.ts",
          anchor: { line: 2, column: 2 },
          snippet: "throw new Error('bad');",
        },
      ],
    });
  });
  it("preserves test suffixes and leaves production throws to their owner", () => {
    expect(
      inspect({
        "src/a.ts": "throw new Error();",
        "src/a.spec.ts": "throw new Error();",
        "src/a.test.tsx": "expect(result).toBe(1);",
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
});
