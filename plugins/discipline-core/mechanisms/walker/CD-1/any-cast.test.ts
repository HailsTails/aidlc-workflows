import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers, WalkerRepository } from "../runner/walker-piece.ts";
import { check } from "./any-cast.ts";

const FILE = repoPathSchema.parse("src/casts.ts");
const ADDRESS = clauseAddressSchema.parse("CD-1#any-cast");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-1",
  settings: { module: "any-cast.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
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
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt, finish: prepared.value.finish };
};

describe("CD-1 existing any-cast capability", () => {
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

  it("emits an any-cast using the supplied anchor and the existing eighty-character snippet", () => {
    const observed = sourceObservations({ source: "candidate as any;\nconst description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "candidate as any; const description = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmno…" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("returns every violating observation in order including an angle-bracket any assertion", () => {
    const observed = sourceObservations({ source: "candidate as any;\n<any>other;\n" });
    const first = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const second = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "candidate as any; <any>other; " },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "<any>other; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 18 }]]);
  });

  it("allows unknown narrowing and preserves the existing multi-argument generic-any classification gap", () => {
    const observed = sourceObservations({ source: "candidate as unknown;\ncandidate as Map<string, any>;\n" });
    const unknownCast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const genericCast = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: unknownCast });
    observed.observers.enter?.({ node: genericCast });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("does not expand the cast-derived capability to a bare any keyword", () => {
    const observed = sourceObservations({ source: "let value: any;\n" });
    const keyword = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree)
      .getChildAt(0, observed.tree).getChildAt(1, observed.tree).getChildAt(0, observed.tree).getChildAt(2, observed.tree);

    observed.observers.enter?.({ node: keyword });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("retains snippet-based attribution when a later any annotation follows a different cast", () => {
    const observed = sourceObservations({ source: "candidate as Profile;\nconst value: any = candidate;\n" });
    const cast = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: cast });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "candidate as Profile; const value: any = candidate; " },
    ]);
  });
});
