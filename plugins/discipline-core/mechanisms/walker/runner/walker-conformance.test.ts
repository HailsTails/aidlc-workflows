import { assert, describe, expect, it, vi } from "vitest";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { type RunnerClause, runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import {
  type ClauseDefinition,
  type DisciplineFile,
  readDisciplineFile,
  readPieceFile,
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

const ruleSetTexts = import.meta.glob(["./rules/CD-14/discipline.json", "./mechanisms/walker/CD-14/piece.json"], {
  base: "../../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const RULE_SET_FILES: Readonly<Record<string, string>> = {
  "/install/rules/CD-14/discipline.json": requiredEntry({ table: ruleSetTexts, key: "./rules/CD-14/discipline.json" }),
  "/install/mechanisms/walker/CD-14/piece.json": requiredEntry({
    table: ruleSetTexts,
    key: "./mechanisms/walker/CD-14/piece.json",
  }),
};

const ruleSetFileText: FileTextPort = {
  read: ({ path }) => ({ outcome: "ok", value: requiredEntry({ table: RULE_SET_FILES, key: path }) }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
};

const ruleSetPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install" });

const cd14Discipline = (): DisciplineFile => {
  const discipline = readDisciplineFile({
    fileText: ruleSetFileText,
    path: ruleSetPath,
    ruleSetRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse("CD-14"),
  });
  assert(discipline.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  return discipline.value;
};

const CD14_DISCIPLINE = cd14Discipline();

const classSyntaxDefinition = (): Extract<ClauseDefinition, { readonly kind: "mechanical" }> => {
  const [definition, judgement, ...surplus] = CD14_DISCIPLINE.clauses;
  assert(definition?.id === "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert(definition.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  assert(definition.anchor.kind === "keyword", "CD-14 class-syntax anchors at a keyword");
  assert(judgement?.kind === "judgement", "CD-14 declares a judgement clause second");
  assert(surplus.length === 0, "CD-14 declares exactly two clauses");
  return definition;
};

const CLASS_SYNTAX_DEFINITION = classSyntaxDefinition();

const classSyntaxSettings = (): unknown => {
  const piece = readPieceFile({
    fileText: ruleSetFileText,
    path: ruleSetPath,
    ruleSetRoot: RULE_SET_ROOT,
    mechanism: mechanismIdSchema.parse("walker"),
    discipline: CD14_DISCIPLINE,
  });
  assert(piece.outcome === "ok", "the CD-14 walker piece.json reads through the rule-set reader");
  const [entry, ...surplus] = piece.value.clauses;
  assert(entry?.clause === "class-syntax", "the CD-14 walker piece carries class-syntax");
  assert(surplus.length === 0, "the CD-14 walker piece carries exactly one clause");
  return entry.settings;
};

const CLASS_SYNTAX_CLAUSE: RunnerClause = {
  address: clauseAddressSchema.parse("CD-14#class-syntax"),
  anchor: CLASS_SYNTAX_DEFINITION.anchor,
  pieceRoot: `${import.meta.dirname}/../CD-14`,
  settings: classSyntaxSettings(),
};

const walkerRunner = runnerModuleSchema.parse(walkerRunnerModule.runner);

describe("the walker runner, loaded as core loads it, conforms to CD-14 class-syntax's shared cases read as build-time raw modules (CD-47: the shipped runner and its piece are the assertion's subject; nothing is spawned or written)", () => {
  it("has no conformance failure over every shared flag and allow case", async () => {
    expect(
      await checkConformance({
        clause: CLASS_SYNTAX_CLAUSE,
        cases: [...CLASS_SYNTAX_DEFINITION.cases.flag, ...CLASS_SYNTAX_DEFINITION.cases.allow],
        runner: walkerRunner,
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });
});
