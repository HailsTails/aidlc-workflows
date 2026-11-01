import { describe, expect, it } from "vitest";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { conformanceRows, foldersUnder } from "../../../tests/conformance-rows.ts";
import { ESLINT_9_VERSION, eslint9CaseMismatches } from "../../../tests/test-fixtures/eslint-9/eslint-9-engine.ts";

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

describe("the ESLint engine behind the compatibility check", () => {
  it("is the 9 line", () => {
    expect(ESLINT_9_VERSION).toMatch(/^9\./);
  });
});

describe("every ESLint piece's shared cases hold under the supported ESLint 9 line, with ESLint 9's own core rules handed to any piece that wraps them (CD-47: the shipped plugin modules are the assertion's subject; nothing is spawned or written)", () => {
  it.each(ROWS)("$name flags and allows what its shared cases expect", async (row) => {
    expect(await eslint9CaseMismatches({ row })).toEqual([]);
  });
});
