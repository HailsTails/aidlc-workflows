import { describe, expect, it, vi } from "vitest";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { conformanceRows, foldersUnder } from "../../../tests/conformance-rows.ts";
import { ESLINT_9_VERSION, linesFlaggedByPiece } from "../../../tests/test-fixtures/eslint-9/eslint-9-engine.ts";
import { eslintPieceSettingsSchema } from "./eslint-piece-settings-schema.ts";

vi.mock("eslint/use-at-your-own-risk", () => import("../../../tests/test-fixtures/eslint-9/builtin-rules.ts"));

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./mechanisms/eslint/*/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/eslint/" }),
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${import.meta.dirname}/..`,
});

const distinctSorted = (lines: readonly number[]): readonly number[] => [...new Set(lines)].sort();

describe("the ESLint engine behind the compatibility check", () => {
  it("is the 9 line", () => {
    expect(ESLINT_9_VERSION.startsWith("9.")).toBe(true);
  });
});

describe("every ESLint piece's shared cases hold under the supported ESLint 9 line, the way the team's own ESLint run loads the pieces (CD-47: the shipped plugin modules are the assertion's subject; nothing is spawned or written)", () => {
  it.each(ROWS)("$name flags and allows what its shared cases expect", async (row) => {
    const settings = eslintPieceSettingsSchema.parse(row.clause.settings);
    for (const sourceCase of row.cases) {
      expect(
        await linesFlaggedByPiece({
          pieceRoot: row.clause.pieceRoot,
          settings,
          fileName: sourceCase.fileName,
          source: sourceCase.source,
        }),
        sourceCase.name,
      ).toEqual(distinctSorted(sourceCase.expectedLines));
    }
  });
});
