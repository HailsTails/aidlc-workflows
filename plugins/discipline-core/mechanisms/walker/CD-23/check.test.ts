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

describe("CD-23 co-located tests", () => {
  it("finds runtime exports missing their exact sibling", () => {
    expect(
      findings({
        "src/a.ts": "export const a = 1;",
        "src/b.tsx": "export default function View() {}",
        "src/b.test.ts": "",
      }),
    ).toHaveLength(2);
  });
  it("accepts matching TS and TSX siblings", () => {
    expect(
      inspect({
        "src/a.ts": "export const a = 1;",
        "src/a.test.ts": "",
        "src/b.tsx": "export default function View() {}",
        "src/b.test.tsx": "",
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("preserves type-only, ambient, composition-root and test-infrastructure exemptions", () => {
    expect(
      inspect({
        "src/types.ts": "export interface A {}",
        "src/ambient.ts": "export declare const a: string;",
        "src/a.d.ts": "export const a: string;",
        "src/App.tsx": "export const app = 1;",
        "src/main.tsx": "export const app = 1;",
        "src/__tests__/helper.ts": "export const helper = 1;",
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("retains export-star and side-effect-only export-surface gaps", () => {
    expect(
      inspect({
        "src/barrel.ts": "export * from './a';",
        "src/not-typescript.mjs": "export const x = 1;",
        "src/effect.ts": "console.log('effect');",
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
  it("keeps named value exports and export assignments runtime-bearing", () => {
    expect(
      findings({
        "src/named.ts": "const a = 1; export { a };",
        "src/default.ts": "export default 1;",
        "src/types.ts": "export { type A } from './a';",
      }),
    ).toHaveLength(2);
  });
});
