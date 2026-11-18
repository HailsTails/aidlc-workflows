// covers: harness-instrument:aidlc-lib-only-shrinks
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";
import { fileWorkspace } from "../../lint/gate/adapters/file-workspace.ts";
import { gitRepository } from "../../lint/gate/adapters/git-repository.ts";
import { ratchetRecords } from "../../lint/gate/adapters/ratchet-records.ts";
import { RECORD_LOCATIONS } from "../../lint/gate/adapters/record-locations.ts";
import {
  declaredNames,
  parseModule,
  typescriptModuleReader,
} from "../../lint/gate/adapters/typescript-module-reader.ts";
import type { GateScope } from "../../lint/gate/application/gate-scope.ts";
import { monolithCheck } from "../../lint/gate/application/monolith-check.ts";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { NATIVE_FIXTURE_SETUP_TIMEOUT_MS } from "../harness/test-budget.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);

const TOOLS = join(REPO_ROOT, "core", "tools");
const LIB = "aidlc-lib.ts";
const IMPORTS_LIB_BEFORE_THE_RULE = new Set([
  "aidlc-audit.ts",
  "aidlc-construction-checkpoints.ts",
  "aidlc-graph.ts",
  "aidlc-swarm-checkpoints.ts",
]);

const UNCHANGED_SCOPE: GateScope = {
  lane: undefined,
  base: undefined,
  changes: [],
  everything: false,
  build: false,
  record: false,
};

const toolModule = (name: string): ts.SourceFile =>
  parseModule({ path: name, text: readFileSync(join(TOOLS, name), "utf8") });

const namedSiblings = (source: ts.SourceFile): readonly string[] => {
  const siblings = source.statements
    .filter((s) => ts.isImportDeclaration(s) || ts.isExportDeclaration(s))
    .map((s) => s.moduleSpecifier)
    .filter((specifier) => specifier !== undefined && ts.isStringLiteral(specifier))
    .map((specifier) => (specifier as ts.StringLiteral).text)
    .filter((text) => /^\.\/[\w.-]+\.ts$/.test(text))
    .map((text) => text.slice(2));
  return [...new Set(siblings)];
};

const isLibSpecifier = (node: ts.Node | undefined): boolean =>
  node !== undefined &&
  ts.isStringLiteralLike(node) &&
  /^\.\/aidlc-lib(?:\.ts|\.js)?$/.test(node.text);

const isDynamicLoad = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword ||
  (ts.isIdentifier(node.expression) && node.expression.text === "require");

const namesLib = (node: ts.Node): boolean => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return isLibSpecifier(node.moduleSpecifier);
  }
  if (ts.isCallExpression(node)) {
    return isDynamicLoad(node) && isLibSpecifier(node.arguments[0]);
  }
  return (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    isLibSpecifier(node.argument.literal)
  );
};

const reachesLib = (source: ts.SourceFile): boolean => {
  const visit = (node: ts.Node): boolean =>
    namesLib(node) || (ts.forEachChild(node, visit) ?? false);
  return visit(source);
};

const sample = (lines: readonly string[]): ts.SourceFile =>
  parseModule({ path: "sample.ts", text: lines.join("\n") });

describe("t-aidlc-lib-only-shrinks", () => {
  test("no monolith gains a top-level declaration or a line over its record", async () => {
    const workspace = fileWorkspace(REPO_ROOT);
    const records = ratchetRecords({
      repository: gitRepository(REPO_ROOT),
      workspace,
      locations: RECORD_LOCATIONS,
    });
    const check = monolithCheck({ records, workspace, modules: typescriptModuleReader });
    const outcome = await check.run(UNCHANGED_SCOPE);
    expect(outcome.findings).toEqual([]);
  });

  test("a module aidlc-lib.ts imports or re-exports never imports it back", () => {
    const back = namedSiblings(toolModule(LIB))
      .filter((sibling) => !IMPORTS_LIB_BEFORE_THE_RULE.has(sibling))
      .filter((sibling) => reachesLib(toolModule(sibling)));
    expect(back, `${back.join(", ")}: move what it needs out of aidlc-lib.ts too`).toEqual([]);
  });

  test("each module that imported aidlc-lib.ts before the rule still does", () => {
    const stale = [...IMPORTS_LIB_BEFORE_THE_RULE].filter(
      (sibling) => !reachesLib(toolModule(sibling)),
    );
    expect(stale, "take it off IMPORTS_LIB_BEFORE_THE_RULE").toEqual([]);
  });
});

describe("t-aidlc-lib-only-shrinks readers", () => {
  test("the readers see code, never a comment or a string", () => {
    const source = sample([
      'import { a } from "./aidlc-x.ts";',
      'import type { B } from "./aidlc-y.ts";',
      'export { c } from "./aidlc-z.ts";',
      'import { readFileSync } from "node:fs";',
      '// function inComment() {} from "./aidlc-lib.ts"',
      'const text = "function inString() {}";',
      "export function placedHere(): void {}",
      "const one = 1, { two, three: [four] } = { two: 2, three: [4] };",
      "export interface Shape {}",
      "type Alias = string;",
      "class Thing {}",
      "enum Kind { A }",
    ]);
    expect(declaredNames(source)).toEqual([
      "text",
      "placedHere",
      "one",
      "two",
      "four",
      "Shape",
      "Alias",
      "Thing",
      "Kind",
    ]);
    expect(namedSiblings(source)).toEqual(["aidlc-x.ts", "aidlc-y.ts", "aidlc-z.ts"]);
    expect(reachesLib(source)).toBe(false);
  });

  test.each([
    'import { x } from "./aidlc-lib.ts";',
    'import type { X } from "./aidlc-lib";',
    'export { x } from "./aidlc-lib.ts";',
    'const lib = require("./aidlc-lib.ts");',
    'const lib = await import("./aidlc-lib.ts");',
    'type Lib = typeof import("./aidlc-lib.ts");',
  ])("reachesLib sees %s", (line) => {
    expect(reachesLib(sample([line]))).toBe(true);
  });
});
