import { describe, expect, it } from "vitest";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { conformanceRows, foldersUnder } from "../../../tests/conformance-rows.ts";
import * as walkerRunnerModule from "./runner.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./mechanisms/audit/*/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerModules = import.meta.glob(["./mechanisms/audit/*/*.ts", "!./mechanisms/audit/*/*.test.ts", "!./mechanisms/audit/runner/*"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerDisciplines = foldersUnder({ table: walkerModules, prefix: "./mechanisms/audit/" });

const CONFORMANCE_ROWS = conformanceRows({
  table: ruleSetTexts,
  disciplines: walkerDisciplines,
  mechanism: mechanismIdSchema.parse("audit"),
  mechanismRoot: `${import.meta.dirname}/..`,
});

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

describe("every audit piece on disk is registered with a piece.json and a discipline.json", () => {
  it("has a piece.json for each audit piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./mechanisms/audit/" })).toEqual(walkerDisciplines);
  });

  it("has a discipline.json for each audit piece folder", () => {
    expect(foldersUnder({ table: ruleSetTexts, prefix: "./rules/" })).toEqual(expect.arrayContaining([...walkerDisciplines]));
  });
});

describe("the audit runner, loaded as core loads it, conforms to every registered clause's shared cases read as build-time raw modules (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: walkerRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
