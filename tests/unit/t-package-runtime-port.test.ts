// covers: file:scripts/package.ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const PACKAGER = join(import.meta.dir, "..", "..", "scripts", "package.ts");
const PORT_TYPE = "PluginRuntimePort";
const PORT_FACTORIES: ReadonlySet<string> = new Set([
  "createPassRuntimePort",
  "createPluginRuntimePort",
  "createSharedPluginRuntimePort",
]);
const MODULE_SCOPE = "<module>";

type PortConstruction = { readonly factory: string; readonly owner: string };

const packager = ts.createSourceFile(PACKAGER, readFileSync(PACKAGER, "utf-8"), ts.ScriptTarget.Latest, true);

function enclosingFunctionName(node: ts.Node): string {
  return ts.findAncestor(node.parent, ts.isFunctionDeclaration)?.name?.text ?? MODULE_SCOPE;
}

function portConstructions(source: ts.SourceFile): readonly PortConstruction[] {
  const found: PortConstruction[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && PORT_FACTORIES.has(node.expression.text)) {
      found.push({ factory: node.expression.text, owner: enclosingFunctionName(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function portParameter(source: ts.SourceFile, functionName: string): ts.ParameterDeclaration | undefined {
  const declaration = source.statements.find((statement): statement is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === functionName);
  if (declaration === undefined) throw new Error(`scripts/package.ts declares no function ${functionName}`);
  return declaration.parameters.find((parameter) => parameter.type?.getText(source) === PORT_TYPE);
}

describe("packager plugin runtime port", () => {
  test("is built only at pass roots, so every tree in a pass shares one compile per entry", () => {
    expect(portConstructions(packager)).toEqual([
      { factory: "createSharedPluginRuntimePort", owner: "createPassRuntimePort" },
      { factory: "createPluginRuntimePort", owner: "createPassRuntimePort" },
      { factory: "createPassRuntimePort", owner: "checkPackageDeterminism" },
      { factory: "createPassRuntimePort", owner: "checkPackageDeterminism" },
      { factory: "createPassRuntimePort", owner: MODULE_SCOPE },
      { factory: "createPassRuntimePort", owner: MODULE_SCOPE },
    ]);
  });

  test.each([
    "buildTree", "writeHarness", "writeReleaseHarness", "buildCheckPass", "emitPlugins", "buildRepositoryPluginProjection",
  ])(
    "%s is handed the pass's port and cannot default to a new one",
    (functionName) => {
      const port = portParameter(packager, functionName);
      expect(port?.type?.getText(packager)).toBe(PORT_TYPE);
      expect(port?.initializer).toBeUndefined();
    },
  );
});
