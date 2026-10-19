import { assert, describe, expect, it, type Mock, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { Anchor } from "../../../core/values/anchor.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import { createDefaultParsePort, type SyntaxTree } from "../runner/typescript-parse.ts";
import type { PreparedWalkerCheck, SourceObservers } from "../runner/walker-piece.ts";
import { check } from "./identifier-names.ts";

const FILE = repoPathSchema.parse("src/naming.ts");
const ADDRESS = clauseAddressSchema.parse("CD-6#identifier-names");
const SYNTAX_API = createDefaultParsePort({}).syntaxApi;
const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/walker/CD-6",
  settings: { module: "identifier-names.ts" },
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
  const anchorAt = vi.fn<(request: { readonly position: number }) => Anchor>().mockReturnValue({ line: 7, column: 2 });
  return { tree, observers: selected.value.begin({ sourceFile: tree, anchorAt }), anchorAt, finish: prepared.value.finish };
};

describe("CD-6 existing binding-name capability", () => {
  it.each([
    { name: "all-depth excluded directory", fileName: "src/node_modules/example.ts", kind: "skipped" },
    { name: "root-only excluded directory", fileName: "vendor/example.ts", kind: "skipped" },
    { name: "nested root-only directory", fileName: "src/vendor/example.ts", kind: "syntax" },
    { name: "TSX source", fileName: "src/example.tsx", kind: "syntax" },
    { name: "test source", fileName: "src/example.test.ts", kind: "syntax" },
    { name: "declaration source", fileName: "src/example.d.ts", kind: "syntax" },
    { name: "physical scripts source", fileName: "scripts/task.ts", kind: "syntax" },
    { name: "non-TypeScript candidate", fileName: "src/example.js", kind: "skipped" },
  ])("preserves source eligibility without a read for $name", ({ fileName, kind }) => {
    const file = repoPathSchema.parse(fileName);
    const prepared = check.prepare({ clauses: [CLAUSE], repository: { files: [file], exists: vi.fn().mockReturnValue("present") }, syntaxApi: SYNTAX_API });
    assert(prepared.outcome === "ok");
    const readText = vi.fn().mockReturnValue({ outcome: "failed", error: { kind: "file-unreadable", file, detail: "unexpected read" } });

    expect(prepared.value.prepareFile({ file, readText })).toMatchObject({ outcome: "ok", value: { kind } });
    expect(readText).not.toHaveBeenCalled();
  });

  it("returns all variable, named-function and parameter observations in order", () => {
    const observed = sourceObservations({ source: "const data = 1;\nfunction cb(value: number) {}\n" });
    const variableStatement = observed.tree.statements[0];
    const functionDeclaration = observed.tree.statements[1];
    assert(SYNTAX_API.isVariableStatement(variableStatement));
    assert(SYNTAX_API.isFunctionDeclaration(functionDeclaration));
    const declaration = variableStatement.declarationList.declarations[0];
    const parameter = functionDeclaration.parameters[0];

    observed.observers.enter?.({ node: declaration });
    observed.observers.leave?.({ node: declaration });
    observed.observers.enter?.({ node: functionDeclaration });
    observed.observers.enter?.({ node: parameter });
    observed.observers.leave?.({ node: parameter });
    observed.observers.leave?.({ node: functionDeclaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "data = 1; function cb(value: number) {} " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "cb(value: number) {} " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "value: number) {} " },
    ]);
    expect(observed.anchorAt.mock.calls).toEqual([[{ position: 6 }], [{ position: 25 }], [{ position: 28 }]]);
    expect(observed.finish()).toEqual({ outcome: "ok", value: [] });
  });

  it("retains case-sensitive domain and unused names while excluding nonbinding identifiers", () => {
    const observed = sourceObservations({ source: "const Data = 1;\nconst _data = 2;\nfunction render(accountData: number) {}\nconst profile = { data: 1 };\nprofile.data;\n" });
    const caseStatement = observed.tree.statements[0];
    const unusedStatement = observed.tree.statements[1];
    const functionDeclaration = observed.tree.statements[2];
    const objectStatement = observed.tree.statements[3];
    const accessStatement = observed.tree.statements[4];
    assert(SYNTAX_API.isVariableStatement(caseStatement));
    assert(SYNTAX_API.isVariableStatement(unusedStatement));
    assert(SYNTAX_API.isFunctionDeclaration(functionDeclaration));
    assert(SYNTAX_API.isVariableStatement(objectStatement));
    assert(SYNTAX_API.isExpressionStatement(accessStatement));
    const objectDeclaration = objectStatement.declarationList.declarations[0];
    const objectLiteral = objectDeclaration.initializer;
    assert(objectLiteral !== undefined && SYNTAX_API.isObjectLiteralExpression(objectLiteral));
    const property = objectLiteral.properties[0];
    assert(SYNTAX_API.isPropertyAssignment(property));
    const access = accessStatement.expression;
    assert(SYNTAX_API.isPropertyAccessExpression(access));

    observed.observers.enter?.({ node: caseStatement.declarationList.declarations[0] });
    observed.observers.leave?.({ node: caseStatement.declarationList.declarations[0] });
    observed.observers.enter?.({ node: unusedStatement.declarationList.declarations[0] });
    observed.observers.leave?.({ node: unusedStatement.declarationList.declarations[0] });
    observed.observers.enter?.({ node: functionDeclaration });
    observed.observers.enter?.({ node: functionDeclaration.parameters[0] });
    observed.observers.leave?.({ node: functionDeclaration.parameters[0] });
    observed.observers.leave?.({ node: functionDeclaration });
    observed.observers.enter?.({ node: objectDeclaration });
    observed.observers.enter?.({ node: property.name });
    observed.observers.leave?.({ node: property.name });
    observed.observers.leave?.({ node: objectDeclaration });
    observed.observers.enter?.({ node: access.name });
    observed.observers.leave?.({ node: access.name });

    expect(observed.observers.finish()).toEqual([]);
    expect(observed.anchorAt).not.toHaveBeenCalled();
  });

  it("observes nested and rest binding names without treating property keys or omitted entries as bindings", () => {
    const observed = sourceObservations({ source: "const { data: accountData, profile: { body }, ...payload } = response;\nconst [, info, ...details] = records;\n" });
    const objectStatement = observed.tree.statements[0];
    const arrayStatement = observed.tree.statements[1];
    assert(SYNTAX_API.isVariableStatement(objectStatement));
    assert(SYNTAX_API.isVariableStatement(arrayStatement));
    const objectDeclaration = objectStatement.declarationList.declarations[0];
    const arrayDeclaration = arrayStatement.declarationList.declarations[0];
    assert(SYNTAX_API.isObjectBindingPattern(objectDeclaration.name));
    assert(SYNTAX_API.isArrayBindingPattern(arrayDeclaration.name));
    const renamedBinding = objectDeclaration.name.elements[0];
    const nestedBinding = objectDeclaration.name.elements[1];
    const restBinding = objectDeclaration.name.elements[2];
    assert(SYNTAX_API.isObjectBindingPattern(nestedBinding.name));
    const nestedName = nestedBinding.name.elements[0];

    observed.observers.enter?.({ node: objectDeclaration });
    observed.observers.enter?.({ node: renamedBinding });
    observed.observers.leave?.({ node: renamedBinding });
    observed.observers.enter?.({ node: nestedBinding });
    observed.observers.enter?.({ node: nestedName });
    observed.observers.leave?.({ node: nestedName });
    observed.observers.leave?.({ node: nestedBinding });
    observed.observers.enter?.({ node: restBinding });
    observed.observers.leave?.({ node: restBinding });
    observed.observers.leave?.({ node: objectDeclaration });
    observed.observers.enter?.({ node: arrayDeclaration });
    observed.observers.enter?.({ node: arrayDeclaration.name.elements[0] });
    observed.observers.leave?.({ node: arrayDeclaration.name.elements[0] });
    observed.observers.enter?.({ node: arrayDeclaration.name.elements[1] });
    observed.observers.leave?.({ node: arrayDeclaration.name.elements[1] });
    observed.observers.enter?.({ node: arrayDeclaration.name.elements[2] });
    observed.observers.leave?.({ node: arrayDeclaration.name.elements[2] });
    observed.observers.leave?.({ node: arrayDeclaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "body }, ...payload } = response; const [, info, ...details] = records; " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "payload } = response; const [, info, ...details] = records; " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "info, ...details] = records; " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "details] = records; " },
    ]);
  });

  it("preserves declaration grouping when a default initializer contains a nested declaration", () => {
    const observed = sourceObservations({ source: "const { data = (() => { const result = 1; return result; })(), body } = report;\n" });
    const outerStatement = observed.tree.statements[0];
    assert(SYNTAX_API.isVariableStatement(outerStatement));
    const outerDeclaration = outerStatement.declarationList.declarations[0];
    assert(SYNTAX_API.isObjectBindingPattern(outerDeclaration.name));
    const firstBinding = outerDeclaration.name.elements[0];
    const secondBinding = outerDeclaration.name.elements[1];
    const defaultInitializer = firstBinding.initializer;
    assert(defaultInitializer !== undefined && SYNTAX_API.isCallExpression(defaultInitializer));
    const parenthesised = defaultInitializer.expression;
    assert(SYNTAX_API.isParenthesizedExpression(parenthesised));
    const initializerFunction = parenthesised.expression;
    assert(SYNTAX_API.isArrowFunction(initializerFunction));
    assert(SYNTAX_API.isBlock(initializerFunction.body));
    const innerStatement = initializerFunction.body.statements[0];
    assert(SYNTAX_API.isVariableStatement(innerStatement));
    const innerDeclaration = innerStatement.declarationList.declarations[0];

    observed.observers.enter?.({ node: outerDeclaration });
    observed.observers.enter?.({ node: firstBinding });
    observed.observers.enter?.({ node: innerDeclaration });
    observed.observers.leave?.({ node: innerDeclaration });
    observed.observers.leave?.({ node: firstBinding });
    observed.observers.enter?.({ node: secondBinding });
    observed.observers.leave?.({ node: secondBinding });
    observed.observers.leave?.({ node: outerDeclaration });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "data = (() => { const result = 1; return result; })(), body } = report; " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "body } = report; " },
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "result = 1; return result; })(), body } = report; " },
    ]);
    expect(observed.anchorAt).toHaveBeenCalledTimes(3);
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 8 });
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 30 });
    expect(observed.anchorAt).toHaveBeenCalledWith({ position: 63 });
  });

  it("retains the existing eighty-character naming snippet and ellipsis", () => {
    const observed = sourceObservations({ source: "const data = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';\n" });
    const statement = observed.tree.statements[0];
    assert(SYNTAX_API.isVariableStatement(statement));

    observed.observers.enter?.({ node: statement.declarationList.declarations[0] });
    observed.observers.leave?.({ node: statement.declarationList.declarations[0] });

    expect(observed.observers.finish()).toEqual([
      { clause: ADDRESS, anchor: { line: 7, column: 2 }, snippet: "data = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrst…" },
    ]);
  });
});
