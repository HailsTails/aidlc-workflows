import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { SourceObservers, WalkerRepository } from "../runner/walker-piece.ts";
import { check } from "./throws-in-tests.ts";

const ADDRESS = clauseAddressSchema.parse("CD-10#throws-in-tests");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-10",
  settings: { module: "throws-in-tests.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
};

const sourceObservations = (request: {
  readonly file: string;
  readonly source: string;
}): ObservationFixture => {
  const file = repoPathSchema.parse(request.file);
  const repository: WalkerRepository = { files: [file], exists: vi.fn().mockReturnValue("present") };
  const prepared = check.prepare({ clauses: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({
    file,
    readText: vi.fn().mockReturnValue({ outcome: "ok", value: request.source }),
  });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(file, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>()
    .mockReturnValue({ line: 5, column: 2 });
  return { tree, observers: selected.value.begin({ sourceFile: tree, anchorAt }), anchorAt };
};

describe("CD-10 existing test throw observation", () => {
  it("reports every top-level throw in an eligible TSX test in observation order", () => {
    const observed = sourceObservations({ file: "src/example.test.tsx", source: "throw first;\nthrow second;\n" });
    const first = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);
    const second = observed.tree.getChildAt(0, observed.tree).getChildAt(1, observed.tree);
    observed.anchorAt.mockReturnValueOnce({ line: 5, column: 2 }).mockReturnValueOnce({ line: 6, column: 0 });

    observed.observers.enter?.({ node: first });
    observed.observers.enter?.({ node: second });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 5, column: 2 }, snippet: "throw first; throw second; " },
      { clause: ADDRESS, anchor: { line: 6, column: 0 }, snippet: "throw second; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 13 }]]);
  });

  it("allows the corrected assertion call without adding a throw finding", () => {
    const observed = sourceObservations({ file: "src/example.test.ts", source: "assert.fail('failure');\n" });
    const statement = observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree);

    observed.observers.enter?.({ node: statement });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it.each(["src/example.ts", "src/example.spec.ts", "src/example.test.js", "src/node_modules/example.test.ts", "vendor/example.test.ts"])("preserves the existing test-family exclusion for %s", (fileName) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({
      clauses: [CLAUSE],
      repository: { files: [file], exists: vi.fn().mockReturnValue("present") },
      syntaxApi: SYNTAX_API,
    });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "ok", value: "throw failure;\n" });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("retains an eligible test under a nested root-only directory without reading during preparation", () => {
    const file = repoPathSchema.parse("src/vendor/example.test.ts");
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    const selected = prepared.value.prepareFile({ file, readText });

    expect(selected).toMatchObject({ outcome: "ok", value: { kind: "syntax", begin: expect.any(Function) } });
    expect(readText).not.toHaveBeenCalled();
  });
});
