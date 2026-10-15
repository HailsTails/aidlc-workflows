import { describe, expect, it } from "vitest";
import { createDefaultParsePort } from "./typescript-parse.ts";

const port = createDefaultParsePort({});
const TWO_STATEMENTS = "const a = 1;\nconst b = 2;\n";

describe("createDefaultParsePort", () => {
  it("parses the given source under the given file name", () => {
    expect(port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS })).toMatchObject({
      fileName: "src/a.ts",
      text: TWO_STATEMENTS,
    });
  });

  it("lists a tree's direct children in source order", () => {
    expect(
      port.children({ node: port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS }) }),
    ).toMatchObject([
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 0 },
      { kind: port.syntaxApi.SyntaxKind.VariableStatement, pos: 12 },
      { kind: port.syntaxApi.SyntaxKind.EndOfFileToken },
    ]);
  });

  it("points a top-level node's parent at its tree", () => {
    const tree = port.parse({ fileName: "src/a.ts", source: TWO_STATEMENTS });

    expect(port.children({ node: tree })[0].parent).toBe(tree);
  });
});
