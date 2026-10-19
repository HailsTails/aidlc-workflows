import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../runner/walker-piece.ts";
import { check } from "./dependency-isolation.ts";

const FILE = repoPathSchema.parse("src/isolation.test.ts");
const ADDRESS = clauseAddressSchema.parse("CD-25#dependency-isolation");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-25",
  settings: { module: "dependency-isolation.ts" },
};

const sourceObservations = (request: { readonly source: string }): {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [FILE], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({ file: FILE, readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }) });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 5, column: 2 });
  return { tree, observers: selected.value.begin({ sourceFile: tree, anchorAt }), anchorAt, finish: prepared.value.finish };
};

describe("CD-25 existing dependency-isolation observations", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/.claude/example.test.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.test.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.test.ts", kind: "syntax" },
    { name: "TSX test", fileName: "src/example.test.tsx", kind: "syntax" },
    { name: "integration test", fileName: "src/example.integration.test.ts", kind: "syntax" },
    { name: "physical scripts test", fileName: "scripts/example.test.ts", kind: "syntax" },
    { name: "ordinary source", fileName: "src/example.ts", kind: "skipped" },
    { name: "non-TypeScript test", fileName: "src/example.test.js", kind: "skipped" },
    { name: "declaration-like test name", fileName: "src/example.d.test.ts", kind: "syntax" },
  ])("preserves test-family eligibility without a read for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("attributes every implementation observation only to CD25 in order with eighty-character snippets", () => {
    const observed = sourceObservations({ source: "vi.fn(() => 1);\ncustom.mockImplementation(() => 2);\nconst marker = 'abcdefghijklmnopqrstuvwxyz';\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const implementationCall = statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const replacementCall = statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: implementationCall });
    observed.observers.enter?.({ node: replacementCall });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "vi.fn(() => 1); custom.mockImplementation(() => 2); const marker = 'abcdefghijkl…" },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "custom.mockImplementation(() => 2); const marker = 'abcdefghijklmnopqrstuvwxyz';…" },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 16 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("preserves non-function arguments and any receiver's zero-argument replacement quirk", () => {
    const observed = sourceObservations({ source: "vi.fn(7);\nforeign.mockImplementation();\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "vi.fn(7); foreign.mockImplementation(); " },
      { clause: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "foreign.mockImplementation(); " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 10 }]]);
  });

  it("allows fixed-return fakes and preserves syntax gaps without reporting other disciplines", () => {
    const observed = sourceObservations({ source: "vi.fn();\nvi.fn().mockReturnValue(1);\nvi.fn().mockResolvedValue(1);\nvi.fn().mockReturnValueOnce(1);\nmock.mockImplementationOnce(() => 1);\nvitest.fn(() => 1);\nvi['fn'](() => 1);\nvi.mock('module');\nrows.filter(predicate);\nthrow failure;\nvi.fn;\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(3, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(4, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(5, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(6, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(7, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(8, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(9, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(10, observed.tree).getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});
