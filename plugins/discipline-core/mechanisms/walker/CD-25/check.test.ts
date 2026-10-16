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

describe("CD-25 test implementation mocks", () => {
  it("finds vi.fn implementations and property mockImplementation calls", () => {
    expect(
      findings({ "a.test.ts": "vi.fn(() => 1);\nport.mockImplementation(() => 2);" }),
    ).toHaveLength(2);
  });
  it("accepts value-only mocks and preserves vi-only matching", () => {
    expect(
      inspect({
        "a.test.ts": "vi.fn().mockReturnValue(1); other.fn(() => 2);",
        "a.ts": "vi.fn(() => 3);",
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
});
