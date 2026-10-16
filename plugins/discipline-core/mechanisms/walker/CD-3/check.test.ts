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

describe("CD-3 package strict flags", () => {
  it("finds present strict flags regardless of value in JSONC", () => {
    expect(
      inspect({
        "packages/a/tsconfig.json":
          '{ /* settings */ "compilerOptions": { "strict": true, "noImplicitOverride": false, }, }',
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          file: "packages/a/tsconfig.json",
          anchor: { line: 1, column: 0 },
          snippet: "compilerOptions.strict = true",
        },
        {
          file: "packages/a/tsconfig.json",
          anchor: { line: 1, column: 0 },
          snippet: "compilerOptions.noImplicitOverride = false",
        },
      ],
    });
  });
  it("permits inherited flags, absent compiler options and other config filenames", () => {
    expect(
      inspect({
        "a/tsconfig.json":
          '{"extends":"../../tsconfig.base.json","compilerOptions":{"target":"ESNext"}}',
        "b/tsconfig.json": "{}",
        "tsconfig.base.json": '{"compilerOptions":{"strict":true}}',
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("retains permissive handling of malformed content", () => {
    expect(inspect({ "a/tsconfig.json": "not json" })).toEqual({ outcome: "ok", value: [] });
  });
});
