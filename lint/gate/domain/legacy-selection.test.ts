import { describe, expect, test } from "bun:test";
import { filterPattern, importsAnyOf } from "./legacy-selection.ts";

const MODULES = ["harness-matrix"];

describe("legacy selection", () => {
  test("a test that imports the followed module is selected, with or without the extension", () => {
    const withExtension = 'import { x } from "../harness/harness-matrix.ts";';
    const without = "import { x } from '../harness/harness-matrix';";
    expect(importsAnyOf({ text: withExtension, modules: MODULES })).toBe(true);
    expect(importsAnyOf({ text: without, modules: MODULES })).toBe(true);
  });

  test("a test that only mentions the module, or imports another, is not selected", () => {
    const mention = "// harness-matrix is mentioned here";
    const other = 'import { y } from "../harness/fixtures.ts";';
    expect(importsAnyOf({ text: mention, modules: MODULES })).toBe(false);
    expect(importsAnyOf({ text: other, modules: MODULES })).toBe(false);
  });

  test("the runner filter names each file without its extension", () => {
    const files = ["tests/unit/t1.test.ts", "tests/unit/t-b.test.ts"];
    expect(filterPattern(files)).toBe("^(t1|t-b)");
  });
});
