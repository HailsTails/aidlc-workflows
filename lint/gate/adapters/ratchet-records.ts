import { z } from "zod";
import type { MonolithShape } from "../domain/monolith.ts";
import { totalOf, type CountsByFile } from "../domain/violation-ratchet.ts";
import type { RatchetRecords, RecordSource, Repository, Workspace } from "../application/ports.ts";

export type MonolithRecordFiles = {
  readonly file: string;
  readonly declarations: string;
};

export type RecordLocations = {
  readonly boundary: string;
  readonly monolithLines: string;
  readonly monoliths: readonly MonolithRecordFiles[];
  readonly upstream: string;
};

type Stores = {
  readonly repository: Repository;
  readonly workspace: Workspace;
  readonly locations: RecordLocations;
};

type CountTable = Readonly<Record<string, Readonly<Record<string, number>>>>;

const Counts = z.record(z.string(), z.number().int().nonnegative());

const BoundarySchema = z.discriminatedUnion("schemaVersion", [
  z.object({ schemaVersion: z.literal(1), perFile: z.record(z.string(), Counts) }),
  z.object({ schemaVersion: z.literal(2), files: z.record(z.string(), Counts) }),
]);

const MonolithLinesSchema = z.object({
  schemaVersion: z.literal(1),
  lines: Counts,
});

const transpose = (perCategory: CountTable): CountsByFile => {
  const files: Record<string, Record<string, number>> = {};
  for (const [category, counts] of Object.entries(perCategory)) {
    for (const [file, count] of Object.entries(counts)) {
      files[file] = { ...files[file], [category]: count };
    }
  }
  return files;
};

const decodeBoundary = (text: string): CountsByFile => {
  const record = BoundarySchema.parse(JSON.parse(text));
  return record.schemaVersion === 1 ? transpose(record.perFile) : record.files;
};

const sortedEntries = (record: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const totalsByCategory = (counts: CountsByFile): Readonly<Record<string, number>> => {
  const totals: Record<string, number> = {};
  for (const [category, count] of Object.values(counts).flatMap(Object.entries)) {
    totals[category] = (totals[category] ?? 0) + count;
  }
  return sortedEntries(totals);
};

const asJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const declarationList = (names: readonly string[]): string =>
  `${[...new Set(names)].sort().join("\n")}\n`;

const namesOf = (text: string): readonly string[] =>
  text.split(/\r?\n/).filter((line) => line !== "");

type RecordRead = { readonly source: RecordSource; readonly path: string };

type MonolithRead = { readonly source: RecordSource; readonly file: string };

const readRecord = (stores: Stores, request: RecordRead): string | undefined =>
  request.source.kind === "head"
    ? stores.workspace.read(request.path)
    : stores.repository.readAt({ commit: request.source.commit, path: request.path });

const recordedLines = (stores: Stores, source: RecordSource): Readonly<Record<string, number>> => {
  const text = readRecord(stores, { source, path: stores.locations.monolithLines });
  return text === undefined ? {} : MonolithLinesSchema.parse(JSON.parse(text)).lines;
};

const monolithAt = (stores: Stores, request: MonolithRead): MonolithShape | undefined => {
  const location = stores.locations.monoliths.find((entry) => entry.file === request.file);
  const names =
    location === undefined
      ? undefined
      : readRecord(stores, { source: request.source, path: location.declarations });
  const lines = recordedLines(stores, request.source)[request.file];
  return names === undefined || lines === undefined
    ? undefined
    : { file: request.file, declarations: namesOf(names), lines };
};

const saveBoundary = (stores: Stores, counts: CountsByFile): void => {
  const content = {
    schemaVersion: 2,
    upstream: stores.locations.upstream,
    total: totalOf(counts),
    totals: totalsByCategory(counts),
    files: counts,
  };
  stores.workspace.write({ path: stores.locations.boundary, content: asJson(content) });
};

const saveMonoliths = (stores: Stores, shapes: readonly MonolithShape[]): void => {
  for (const location of stores.locations.monoliths) {
    const shape = shapes.find((candidate) => candidate.file === location.file);
    if (shape !== undefined) {
      const content = declarationList(shape.declarations);
      stores.workspace.write({ path: location.declarations, content });
    }
  }
  const lines = sortedEntries(Object.fromEntries(shapes.map((shape) => [shape.file, shape.lines])));
  const content = asJson({ schemaVersion: 1, lines });
  stores.workspace.write({ path: stores.locations.monolithLines, content });
};

export const ratchetRecords = (stores: Stores): RatchetRecords => {
  const { locations } = stores;
  return {
    globs: [
      locations.boundary,
      locations.monolithLines,
      ...locations.monoliths.map((entry) => entry.declarations),
    ],
    monolithFiles: locations.monoliths.map((entry) => entry.file),
    boundary: (source) => {
      const text = readRecord(stores, { source, path: locations.boundary });
      return text === undefined ? undefined : decodeBoundary(text);
    },
    monolith: (request) => monolithAt(stores, request),
    saveBoundary: (counts) => saveBoundary(stores, counts),
    saveMonoliths: (shapes) => saveMonoliths(stores, shapes),
  };
};
