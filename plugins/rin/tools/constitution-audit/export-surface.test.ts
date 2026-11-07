import { expect, test } from "vitest";
import { exportSurfaceOf } from "./export-surface.js";

test.each([
  {
    shape: "an exported type alias",
    sourceText: "export type Shape = { readonly side: number };",
  },
  {
    shape: "an exported interface",
    sourceText: "export interface Shape { readonly side: number }",
  },
  {
    shape: "a type-only export list",
    sourceText: "type Shape = number;\nexport type { Shape };",
  },
  {
    shape: "an export list whose every specifier is type-marked",
    sourceText:
      "type Shape = number;\ntype Side = number;\nexport { type Shape, type Side };",
  },
  {
    shape: "an ambient declared constant",
    sourceText: "export declare const side: number;",
  },
  {
    shape: "a namespace re-export",
    sourceText: 'export * from "./shape.js";',
  },
  {
    shape: "an unexported runtime binding",
    sourceText: "const side = 1;\nexport type Side = typeof side;",
  },
])("$shape is types-only", ({ sourceText }) => {
  expect(exportSurfaceOf({ fileName: "module.ts", sourceText })).toBe(
    "types-only",
  );
});

test.each([
  {
    shape: "an exported constant",
    sourceText: "export const side = 1;",
  },
  {
    shape: "an exported function",
    sourceText: "export function areaOf(side: number): number { return side; }",
  },
  {
    shape: "an exported enum",
    sourceText: "export enum Corner { Top, Bottom }",
  },
  {
    shape: "a default-exported identifier",
    sourceText: "const side = 1;\nexport default side;",
  },
  {
    shape: "an export list naming a runtime value",
    sourceText: "const side = 1;\nexport { side };",
  },
  {
    shape:
      "an export list leading with a type specifier then naming a runtime value",
    sourceText:
      "type Shape = number;\nconst side = 1;\nexport { type Shape, side };",
  },
  {
    shape: "a runtime re-export from another module",
    sourceText: 'export { side } from "./shape.js";',
  },
])("$shape carries runtime", ({ sourceText }) => {
  expect(exportSurfaceOf({ fileName: "module.ts", sourceText })).toBe(
    "carries-runtime",
  );
});

test("a tsx module exporting a component carries runtime", () => {
  expect(
    exportSurfaceOf({
      fileName: "module.tsx",
      sourceText: "export const Badge = () => <span>rin</span>;",
    }),
  ).toBe("carries-runtime");
});
