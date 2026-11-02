// covers: file:scripts/package.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const PACKAGER = join(import.meta.dir, "..", "..", "scripts", "package.ts");
const PORT_FACTORIES: ReadonlySet<string> = new Set([
  "createPassRuntimePort",
  "createPluginRuntimePort",
  "createSharedPluginRuntimePort",
]);
const MODULE_SCOPE = "<module>";
const PASS_ROOTS = ["createPassRuntimePort", "checkPackageDeterminism", MODULE_SCOPE];

const packagerSource = ts.createSourceFile(PACKAGER, readFileSync(PACKAGER, "utf-8"), ts.ScriptTarget.Latest, true);

function ownerOf(node: ts.Node): string {
  return ts.findAncestor(node.parent, ts.isFunctionDeclaration)?.name?.text ?? MODULE_SCOPE;
}

function isPortConstruction(node: ts.Node): node is ts.CallExpression {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && PORT_FACTORIES.has(node.expression.text);
}

function portConstructionOwners(node: ts.Node): readonly string[] {
  const own = isPortConstruction(node) ? [ownerOf(node)] : [];
  return [...own, ...node.getChildren().flatMap(portConstructionOwners)];
}

describe("packager plugin runtime port", () => {
  test("is built only at pass roots, so every tree in a pass shares one compile per entry", () => {
    expect([...new Set(portConstructionOwners(packagerSource))].sort()).toEqual([...PASS_ROOTS].sort());
  });
});
