import { assert, describe, expect, it, vi } from "vitest";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { type RunnerClause, runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import {
  type DisciplineFile,
  readDisciplineFile,
  readPieceFile,
  type SourceCase,
} from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { disciplineIdSchema, mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { requiredEntry } from "../../../tests/required-entry.ts";
import * as walkerRunnerModule from "./runner.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const ruleSetTexts = import.meta.glob(["./rules/*/discipline.json", "./mechanisms/walker/*/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerModules = import.meta.glob(["./mechanisms/walker/*/*.ts", "!./mechanisms/walker/*/*.test.ts", "!./mechanisms/walker/runner/*"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const RULE_SET_ROOT = absolutePathSchema.parse("/install");
const WALKER = mechanismIdSchema.parse("walker");

const folderOf = (request: { readonly key: string }): string => request.key.split("/").at(-2) ?? "";

const ruleSetFileText: FileTextPort = {
  read: ({ path }) => ({
    outcome: "ok",
    value: requiredEntry({ table: ruleSetTexts, key: path.replace("/install/", "./") }),
  }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
};

const ruleSetPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const walkerDisciplines: readonly string[] = [
  ...new Set(Object.keys(walkerModules).map((key) => folderOf({ key }))),
].sort();

const disciplineOf = (request: { readonly discipline: string }): DisciplineFile => {
  const discipline = readDisciplineFile({
    fileText: ruleSetFileText,
    path: ruleSetPath,
    ruleSetRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(discipline.outcome === "ok", `${request.discipline} discipline.json reads through the rule-set reader`);
  return discipline.value;
};

type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const conformanceRowsOf = (request: { readonly discipline: string }): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readPieceFile({
    fileText: ruleSetFileText,
    path: ruleSetPath,
    ruleSetRoot: RULE_SET_ROOT,
    mechanism: WALKER,
    discipline,
  });
  assert(piece.outcome === "ok", `${request.discipline} walker piece.json reads through the rule-set reader`);
  return piece.value.clauses.map((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(definition?.kind === "mechanical", `${request.discipline}#${entry.clause} is a mechanical clause`);
    return {
      name: `${request.discipline}#${entry.clause}`,
      clause: {
        address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
        anchor: definition.anchor,
        pieceRoot: `${import.meta.dirname}/../${request.discipline}`,
        settings: entry.settings,
      },
      cases: [...definition.cases.flag, ...definition.cases.allow],
    };
  });
};

const CONFORMANCE_ROWS = walkerDisciplines.flatMap((discipline) => conformanceRowsOf({ discipline }));

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

describe("every walker piece on disk is registered with a piece.json and a discipline.json", () => {
  it("has a piece.json for each walker piece folder", () => {
    expect(
      Object.keys(ruleSetTexts)
        .filter((key) => key.startsWith("./mechanisms/walker/"))
        .map((key) => folderOf({ key }))
        .sort(),
    ).toEqual(walkerDisciplines);
  });

  it("has a discipline.json for each walker piece folder", () => {
    expect(
      Object.keys(ruleSetTexts)
        .filter((key) => key.startsWith("./rules/"))
        .map((key) => folderOf({ key }))
        .sort(),
    ).toEqual(expect.arrayContaining([...walkerDisciplines]));
  });
});

describe("the walker runner, loaded as core loads it, conforms to every registered clause's shared cases read as build-time raw modules (CD-47: the shipped runner and its pieces are the assertion's subject; nothing is spawned or written)", () => {
  it.each(CONFORMANCE_ROWS)("$name has no conformance failure over its flag and allow cases", async (row) => {
    expect(await checkConformance({ clause: row.clause, cases: row.cases, runner: walkerRunner })).toEqual({
      outcome: "ok",
      value: [],
    });
  });
});
