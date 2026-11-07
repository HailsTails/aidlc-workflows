import { assert, vi } from "vitest";
import type { RunnerClause } from "../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../core/platform-ports/path-port.ts";
import {
  type DisciplineFile,
  readDisciplineFile,
  readPieceFile,
  type SourceCase,
} from "../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../core/values/clause-address.ts";
import { disciplineIdSchema, type MechanismId } from "../core/values/identifiers.ts";
import { requiredEntry } from "./required-entry.ts";

export type RawTable = Readonly<Record<string, string>>;

export type ConformanceRow = {
  readonly name: string;
  readonly clause: RunnerClause;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse("/install");

const folderOf = (request: { readonly key: string }): string => request.key.split("/").at(-2) ?? "";

export const foldersUnder = (request: { readonly table: RawTable; readonly prefix: string }): readonly string[] =>
  [
    ...new Set(
      Object.keys(request.table)
        .filter((key) => key.startsWith(request.prefix))
        .map((key) => folderOf({ key })),
    ),
  ].sort();

const tableFileText = (request: { readonly table: RawTable }): FileTextPort => ({
  read: ({ path }) => ({
    outcome: "ok",
    value: requiredEntry({ table: request.table, key: path.replace("/install/", "./") }),
  }),
  exists: () => "present",
  write: vi.fn<FileTextPort["write"]>(),
});

const disciplineOf = (request: { readonly fileText: FileTextPort; readonly discipline: string }): DisciplineFile => {
  const discipline = readDisciplineFile({
    fileText: request.fileText,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: RULE_SET_ROOT,
    discipline: disciplineIdSchema.parse(request.discipline),
  });
  assert(discipline.outcome === "ok", `${request.discipline} discipline.json reads through the rule-set reader`);
  return discipline.value;
};

const rowsOf = (request: {
  readonly fileText: FileTextPort;
  readonly discipline: string;
  readonly mechanism: MechanismId;
  readonly mechanismRoot: string;
}): readonly ConformanceRow[] => {
  const discipline = disciplineOf(request);
  const piece = readPieceFile({
    fileText: request.fileText,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: RULE_SET_ROOT,
    mechanism: request.mechanism,
    discipline,
  });
  assert(piece.outcome === "ok", `${request.discipline} ${request.mechanism} piece.json reads through the rule-set reader`);
  return piece.value.clauses.map((entry) => {
    const definition = discipline.clauses.find((clause) => clause.id === entry.clause);
    assert(definition?.kind === "mechanical", `${request.discipline}#${entry.clause} is a mechanical clause`);
    return {
      name: `${request.discipline}#${entry.clause}`,
      clause: {
        address: clauseAddressSchema.parse(`${request.discipline}#${entry.clause}`),
        anchor: definition.anchor,
        pieceRoot: `${request.mechanismRoot}/${request.discipline}`,
        settings: entry.settings,
      },
      cases: [...definition.cases.flag, ...definition.cases.allow],
    };
  });
};

export const conformanceRows = (request: {
  readonly table: RawTable;
  readonly disciplines: readonly string[];
  readonly mechanism: MechanismId;
  readonly mechanismRoot: string;
}): readonly ConformanceRow[] => {
  const fileText = tableFileText({ table: request.table });
  return request.disciplines.flatMap((discipline) =>
    rowsOf({ fileText, discipline, mechanism: request.mechanism, mechanismRoot: request.mechanismRoot }),
  );
};
