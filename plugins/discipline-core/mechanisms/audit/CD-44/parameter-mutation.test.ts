import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers, WalkerFile, WalkerRepository } from "../runner/walker-piece.ts";
import { check } from "./parameter-mutation.ts";

const FILE = repoPathSchema.parse("src/mutation.ts");
const ADDRESS = clauseAddressSchema.parse("CD-44#parameter-mutation");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-44",
  settings: { module: "parameter-mutation.ts" },
};

type ObservationFixture = {
  readonly tree: SyntaxTree;
  readonly observers: SourceObservers;
  readonly anchorAt: Mock<(request: { readonly position: number }) => Anchor>;
  readonly finish: PreparedWalkerCheck["finish"];
};

const sourceObservations = (request: { readonly source: string }): ObservationFixture => {
  const repository: WalkerRepository = { files: [FILE], exists: vi.fn<WalkerRepository["exists"]>().mockReturnValue("present") };
  const prepared = check.prepare({ clauses: [CLAUSE], repository, syntaxApi: SYNTAX_API });
  assert(prepared.outcome === "ok");
  const readText = vi.fn<WalkerFile["readText"]>().mockReturnValue({ outcome: "ok", value: request.source });
  const file = prepared.value.prepareFile({ file: FILE, readText });
  expect(file).toMatchObject({ outcome: "ok", value: { kind: "syntax" } });
  assert(file.outcome === "ok" && file.value.kind === "syntax");
  expect(readText).not.toHaveBeenCalled();
  const tree = SYNTAX_API.createSourceFile(FILE, request.source, SYNTAX_API.ScriptTarget.Latest, true);
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 3, column: 2 });
  return { tree, observers: file.value.begin({ sourceFile: tree, anchorAt }), anchorAt, finish: prepared.value.finish };
};

describe("CD44 existing parameter mutation capability", () => {
  it.each([
    { name: "TSX source", fileName: "src/view.tsx" },
    { name: "test source", fileName: "src/view.test.ts" },
    { name: "declaration source", fileName: "src/view.d.ts" },
    { name: "physical script", fileName: "scripts/task.ts" },
    { name: "nested root-only directory", fileName: "src/vendor/view.ts" },
  ])("admits $name without requesting text", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>();

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind: "syntax" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it.each([
    { name: "non-TypeScript union candidate", fileName: "src/view.test.js" },
    { name: "all-depth excluded directory", fileName: "src/node_modules/view.ts" },
    { name: "root-only excluded directory", fileName: "vendor/view.ts" },
  ])("excludes $name without requesting text", ({ fileName }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn<WalkerFile["readText"]>();

    expect(prepared.value.prepareFile({ file, readText })).toEqual({ outcome: "ok", value: { kind: "skipped" } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("activates later destructured names before an earlier parameter initializer", () => {
    const observed = sourceObservations({ source: "function f(first = (later.x = 1), { later }) { later.y = 2; }" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const initializer = declaration.parameters[0]?.initializer;
    assert(initializer !== undefined && SYNTAX_API.isParenthesizedExpression(initializer));
    const bodyStatement = declaration.body?.statements[0];
    assert(bodyStatement !== undefined && SYNTAX_API.isExpressionStatement(bodyStatement));
    observed.anchorAt.mockReturnValueOnce({ line: 1, column: 20 }).mockReturnValueOnce({ line: 1, column: 47 });

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: initializer.expression });
    observed.observers.leave?.({ node: initializer.expression });
    observed.observers.enter?.({ node: bodyStatement.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 1, column: 20 }, snippet: "later.x = 1), { later }) { later.y = 2; }" },
      { clause: ADDRESS, anchor: { line: 1, column: 47 }, snippet: "later.y = 2; }" },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 20 }], [{ position: 47 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains outer names inside an arrow and removes its inner names on leave", () => {
    const observed = sourceObservations({ source: "function f(outer) { const inner = (local) => { outer.x = 1; local.y = 2; }; outer.z = 3; local.z = 4; }" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const variable = declaration.body?.statements[0];
    assert(variable !== undefined && SYNTAX_API.isVariableStatement(variable));
    const inner = variable.declarationList.declarations[0]?.initializer;
    assert(inner !== undefined && SYNTAX_API.isArrowFunction(inner) && SYNTAX_API.isBlock(inner.body));
    const outerMutation = inner.body.statements[0];
    const innerMutation = inner.body.statements[1];
    const afterInner = declaration.body?.statements[1];
    const leakedInner = declaration.body?.statements[2];
    assert(outerMutation !== undefined && SYNTAX_API.isExpressionStatement(outerMutation));
    assert(innerMutation !== undefined && SYNTAX_API.isExpressionStatement(innerMutation));
    assert(afterInner !== undefined && SYNTAX_API.isExpressionStatement(afterInner));
    assert(leakedInner !== undefined && SYNTAX_API.isExpressionStatement(leakedInner));

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: inner });
    observed.observers.enter?.({ node: outerMutation.expression });
    observed.observers.leave?.({ node: outerMutation.expression });
    observed.observers.enter?.({ node: innerMutation.expression });
    observed.observers.leave?.({ node: inner });
    observed.observers.enter?.({ node: afterInner.expression });
    observed.observers.enter?.({ node: leakedInner.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "outer.x = 1; local.y = 2; }; outer.z = 3; local.z = 4; }" },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "local.y = 2; }; outer.z = 3; local.z = 4; }" },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "outer.z = 3; local.z = 4; }" },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledTimes(3);
  });

  it("uses nested renamed, array and rest bindings while retaining the unbound property-key gap", () => {
    const observed = sourceObservations({ source: "function f({ key: { input } }, [, item, ...rest]) { input.x = 1; item.push(1); rest.sort(); key.x = 2; }" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const field = declaration.body?.statements[0];
    const push = declaration.body?.statements[1];
    const sort = declaration.body?.statements[2];
    const unbound = declaration.body?.statements[3];
    assert(field !== undefined && SYNTAX_API.isExpressionStatement(field));
    assert(push !== undefined && SYNTAX_API.isExpressionStatement(push));
    assert(sort !== undefined && SYNTAX_API.isExpressionStatement(sort));
    assert(unbound !== undefined && SYNTAX_API.isExpressionStatement(unbound));

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: field.expression });
    observed.observers.enter?.({ node: push.expression });
    observed.observers.enter?.({ node: sort.expression });
    observed.observers.enter?.({ node: unbound.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "input.x = 1; item.push(1); rest.sort(); key.x = 2; }" },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "item.push(1); rest.sort(); key.x = 2; }" },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "rest.sort(); key.x = 2; }" },
    ]);
  });

  it("retains property and element access roots for equals and delete", () => {
    const observed = sourceObservations({ source: "function f(input) { input.deep[0].x = 1; delete input.deep[0].x; }" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const assignment = declaration.body?.statements[0];
    const deletion = declaration.body?.statements[1];
    assert(assignment !== undefined && SYNTAX_API.isExpressionStatement(assignment));
    assert(deletion !== undefined && SYNTAX_API.isExpressionStatement(deletion));

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: assignment.expression });
    observed.observers.enter?.({ node: deletion.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "input.deep[0].x = 1; delete input.deep[0].x; }" },
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "delete input.deep[0].x; }" },
    ]);
  });

  it("keeps direct, compound, computed-method and alias mutations outside the existing predicate", () => {
    const observed = sourceObservations({ source: "function f(input) { input = other; input.x += 1; input.x++; delete input; input['push'](1); input.set('k', 1); const copy = input; copy.x = 2; (input).x = 3; }" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const direct = declaration.body?.statements[0];
    const compound = declaration.body?.statements[1];
    const update = declaration.body?.statements[2];
    const bareDelete = declaration.body?.statements[3];
    const computedMethod = declaration.body?.statements[4];
    const unlistedMethod = declaration.body?.statements[5];
    const alias = declaration.body?.statements[7];
    const parenthesized = declaration.body?.statements[8];
    assert(direct !== undefined && SYNTAX_API.isExpressionStatement(direct));
    assert(compound !== undefined && SYNTAX_API.isExpressionStatement(compound));
    assert(update !== undefined && SYNTAX_API.isExpressionStatement(update));
    assert(bareDelete !== undefined && SYNTAX_API.isExpressionStatement(bareDelete));
    assert(computedMethod !== undefined && SYNTAX_API.isExpressionStatement(computedMethod));
    assert(unlistedMethod !== undefined && SYNTAX_API.isExpressionStatement(unlistedMethod));
    assert(alias !== undefined && SYNTAX_API.isExpressionStatement(alias));
    assert(parenthesized !== undefined && SYNTAX_API.isExpressionStatement(parenthesized));

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: direct.expression });
    observed.observers.enter?.({ node: compound.expression });
    observed.observers.enter?.({ node: update.expression });
    observed.observers.enter?.({ node: bareDelete.expression });
    observed.observers.enter?.({ node: computedMethod.expression });
    observed.observers.enter?.({ node: unlistedMethod.expression });
    observed.observers.enter?.({ node: alias.expression });
    observed.observers.enter?.({ node: parenthesized.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("preserves the eighty-character source snippet at a mutation node", () => {
    const observed = sourceObservations({ source: "function f(input) { input.a = 1; }\n01234567890123456789012345678901234567890123456789012345678901234567890123456789" });
    const declaration = observed.tree.statements[0];
    assert(declaration !== undefined && SYNTAX_API.isFunctionDeclaration(declaration));
    const statement = declaration.body?.statements[0];
    assert(statement !== undefined && SYNTAX_API.isExpressionStatement(statement));

    observed.observers.enter?.({ node: declaration });
    observed.observers.enter?.({ node: statement.expression });
    observed.observers.leave?.({ node: declaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 3, column: 2 }, snippet: "input.a = 1; } 01234567890123456789012345678901234567890123456789012345678901234…" },
    ]);
  });
});
