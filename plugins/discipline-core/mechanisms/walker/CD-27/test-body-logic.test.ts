import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers, WalkerFile } from "../runner/walker-piece.ts";
import { check } from "./test-body-logic.ts";

const FILE = repoPathSchema.parse("src/logic.test.ts");
const ADDRESS = clauseAddressSchema.parse("CD-27#test-body-logic");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-27",
  settings: { module: "test-body-logic.ts" },
};

const sourceObservations = (request: { readonly source: string }): {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
} => {
  const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [FILE], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const selected = prepared.value.prepareFile({ file: FILE, readText: vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: request.source }) });
  assert(selected.outcome === "ok");
  assert(selected.value.kind === "syntax");
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 1, column: 0 });
  return { tree, observers: selected.value.begin({ sourceFile: tree, anchorAt }), anchorAt, finish: prepared.value.finish };
};

describe("CD-27 existing whole-test-file logic observations", () => {
  it.each([
    { name: "all-depth exclusion", fileName: "src/.claude/logic.test.ts", kind: "skipped" },
    { name: "root-only exclusion", fileName: "vendor/logic.test.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/logic.test.ts", kind: "syntax" },
    { name: "TSX test", fileName: "src/logic.test.tsx", kind: "syntax" },
    { name: "integration test", fileName: "src/logic.integration.test.ts", kind: "syntax" },
    { name: "physical script test", fileName: "scripts/logic.test.ts", kind: "syntax" },
    { name: "ordinary source", fileName: "src/logic.ts", kind: "skipped" },
    { name: "non-TypeScript test", fileName: "src/logic.test.js", kind: "skipped" },
  ])("preserves own test-family eligibility without reading for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("emits all structural observations in encounter order with one finding for a multi-binding let statement", () => {
    const observed = sourceObservations({ source: "if(x)f();\ntry{}catch(e){}\nx?y:z;\nlet a,b;\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const letStatement = statements.getChildAt(3, observed.tree);
    assert(SYNTAX_API.isVariableStatement(letStatement));
    const firstBinding = letStatement.declarationList.declarations[0];
    const secondBinding = letStatement.declarationList.declarations[1];
    assert(firstBinding !== undefined);
    assert(secondBinding !== undefined);
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 }).mockReturnValueOnce({ line: 3, column: 0 }).mockReturnValueOnce({ line: 4, column: 0 });

    observed.observers.enter?.({ node: statements.getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(1, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: letStatement });
    observed.observers.enter?.({ node: letStatement.declarationList });
    observed.observers.enter?.({ node: firstBinding });
    observed.observers.enter?.({ node: secondBinding });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "if(x)f(); try{}catch(e){} x?y:z; let a,b; " },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "try{}catch(e){} x?y:z; let a,b; " },
      { clause: ADDRESS, anchor: { line: 3, column: 0 }, snippet: "x?y:z; let a,b; " },
      { clause: ADDRESS, anchor: { line: 4, column: 0 }, snippet: "let a,b; " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 10 }], [{ position: 26 }], [{ position: 33 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains dynamic and mutation calls at module level and inside a nested callback without a callback gate", () => {
    const observed = sourceObservations({ source: "r.map(f);\r\nr.push(1);\r\nit('',()=>s.filter(f));\r\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const testCall = statements.getChildAt(2, observed.tree).getChildAt(0, observed.tree);
    assert(SYNTAX_API.isCallExpression(testCall));
    const callback = testCall.arguments[1];
    assert(callback !== undefined);
    assert(SYNTAX_API.isArrowFunction(callback));
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 0 }).mockReturnValueOnce({ line: 2, column: 0 }).mockReturnValueOnce({ line: 3, column: 10 });

    observed.observers.enter?.({ node: statements.getChildAt(0, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(1, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: testCall });
    observed.observers.enter?.({ node: callback });
    observed.observers.enter?.({ node: callback.body });
    observed.observers.leave?.({ node: callback });
    observed.observers.leave?.({ node: testCall });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "r.map(f);\r r.push(1);\r it('',()=>s.filter(f));\r " },
      { clause: ADDRESS, anchor: { line: 2, column: 0 }, snippet: "r.push(1);\r it('',()=>s.filter(f));\r " },
      { clause: ADDRESS, anchor: { line: 3, column: 10 }, snippet: "s.filter(f));\r " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 0 }], [{ position: 11 }], [{ position: 33 }]]);
  });

  it("adds the original ellipsis at exactly eighty source characters without collapsing whitespace", () => {
    const observed = sourceObservations({ source: "r.map(f);\nabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr" });

    observed.observers.enter?.({ node: observed.tree.getChildAt(0, observed.tree).getChildAt(0, observed.tree).getChildAt(0, observed.tree) });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 0 }, snippet: "r.map(f); abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqr…" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledExactlyOnceWith({ position: 0 });
  });

  it("preserves computed, alias, declaration-list and conditional-type gaps without duplicating CD25 CD26 or CD10", () => {
    const observed = sourceObservations({ source: "const a=1;\nvar b=2;\nfor(let i=0;i<1;i++){}\nr['map'](f);\nmap(f);\nr.custom();\nvi.fn(()=>1);\nm.mockImplementation(()=>1);\nvi.mock('module');\nthrow failure;\ntype Flag = X extends Y ? A : B;\n" });
    const statements = observed.tree.getChildAt(0, observed.tree);
    const forStatement = statements.getChildAt(2, observed.tree);
    assert(SYNTAX_API.isForStatement(forStatement));
    assert(forStatement.initializer !== undefined);
    const typeDeclaration = statements.getChildAt(10, observed.tree);
    assert(SYNTAX_API.isTypeAliasDeclaration(typeDeclaration));

    observed.observers.enter?.({ node: statements.getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(1, observed.tree) });
    observed.observers.enter?.({ node: forStatement });
    observed.observers.enter?.({ node: forStatement.initializer });
    observed.observers.enter?.({ node: statements.getChildAt(3, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(4, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(5, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(6, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(7, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(8, observed.tree).getChildAt(0, observed.tree) });
    observed.observers.enter?.({ node: statements.getChildAt(9, observed.tree) });
    observed.observers.enter?.({ node: typeDeclaration.type });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });
});
