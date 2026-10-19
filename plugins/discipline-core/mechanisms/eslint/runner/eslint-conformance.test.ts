import { describe, expect, it } from "vitest";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { conformanceRows, foldersUnder } from "../../../tests/conformance-rows.ts";
import * as eslintRunnerModule from "./runner.ts";

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

const eslintDisciplines = foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/eslint/" });

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: eslintDisciplines,
  mechanism: mechanismIdSchema.parse("eslint"),
  mechanismRoot: `${import.meta.dirname}/..`,
});

const eslintRunner = runnerModuleSchema.parse(eslintRunnerModule.runner);

describe("every ESLint piece on disk is registered against a discipline.json", () => {
  it("has a discipline.json for each ESLint piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./rules/" })).toEqual(
      expect.arrayContaining([...eslintDisciplines]),
    );
  });
});

describe("the ESLint runner, loaded as core loads it, conforms to every registered ESLint clause's shared cases on real ESLint (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: eslintRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
