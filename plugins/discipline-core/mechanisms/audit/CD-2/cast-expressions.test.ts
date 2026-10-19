import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { SourceObservers, WalkerRepository } from "../runner/walker-piece.ts";
import { check } from "./cast-expressions.ts";

const FILE = repoPathSchema.parse("src/casts.ts");
const ADDRESS = clauseAddressSchema.parse("CD-2#cast-expressions");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-2",
  settings: { module: "cast-expressions.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
};

const sourceObservations = (request: { readonly source: string }): ObservationFixture => {
  const repository: WalkerRepository = { files: [FILE], exists: vi.fn().mockReturnValue("present") };
  const prepared = check.prepare({ clauses: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const file = prepared.value.prepareFile({
    file: FILE,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(file.outcome === "ok");
  assert(file.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 3, column: 2 });
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt };
};

describe("CD-2 existing cast capability", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/node_modules/example.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "non-TypeScript union candidate", fileName: "src/example.test.js", kind: "skipped" },
  ])("preserves source-family eligibility for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("emits an arbitrary cast with its owned clause, supplied anchor and eighty-character snippet", () => {
    const observed = sourceObservations({ source: "rawText as Category;\nconst description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "rawText as Category; const description = 'abcdefghijklmnopqrstuvwxyzabcdefghijkl…" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("returns every violating observation in its supplied order", () => {
    const observed = sourceObservations({ source: "rawText as Category;\n<Category>other;\n" });
    const first = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const second = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "rawText as Category; <Category>other; " },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "<Category>other; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 21 }]]);
  });

  it("retains the existing angle-bracket type assertion predicate", () => {
    const observed = sourceObservations({ source: "<Category>rawText;\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "<Category>rawText; " },
    ]);
  });

  it("retains allowed syntax forms and prepares aliased Zod names from a later top-level import", () => {
    const observed = sourceObservations({ source: "candidate as unknown;\n'permitted' as const;\nschema as Schema;\njsonSchema as Tool['inputSchema'];\nallResult.value as ReadonlyArray<RowShape>;\nimport type { ZodObject as Schema } from 'zod/v4';\n" });
    const unknownCast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const constCast = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    const zodCast = observed.tree.getChildAt(0, observed.tree).getChildAt(2, observed.tree).getChildAt(0, observed.tree);
    const toolCast = observed.tree.getChildAt(0, observed.tree).getChildAt(3, observed.tree).getChildAt(0, observed.tree);
    const rowCast = observed.tree.getChildAt(0, observed.tree).getChildAt(4, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: unknownCast });
    observed.observers.enter?.({ node: constCast });
    observed.observers.enter?.({ node: zodCast });
    observed.observers.enter?.({ node: toolCast });
    observed.observers.enter?.({ node: rowCast });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("does not admit a locally declared Zod-prefixed type as an imported Zod name", () => {
    const observed = sourceObservations({ source: "type ZodInternalCarrier = {};\nschema as ZodInternalCarrier;\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "schema as ZodInternalCarrier; " },
    ]);
  });

  it("excludes existing CD-1 snippet matches while retaining the multi-argument generic-any classification gap", () => {
    const observed = sourceObservations({ source: "candidate as any;\ncandidate as Map<string, any>;\n" });
    const anyCast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const genericCast = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: anyCast });
    observed.observers.enter?.({ node: genericCast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "candidate as Map<string, any>; " },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 18 });
  });
});
