import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import {
  type DisciplineFile,
  readPieceFile,
} from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import {
  clauseIdSchema,
  disciplineIdSchema,
  mechanismIdSchema,
} from "../../../core/values/identifiers.ts";
import { requiredEntry } from "../../../tests/required-entry.ts";
import { walkerPieceSettingsSchema } from "../runner/walker-check-schema.ts";
import piece from "./piece.json" with { type: "json" };

const fileText: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify(piece) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/install","mechanisms","walker","CD-14","piece.json"]':
    "/install/mechanisms/walker/CD-14/piece.json",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const CD14: DisciplineFile = {
  version: 1,
  id: disciplineIdSchema.parse("CD-14"),
  clauses: [
    {
      kind: "judgement",
      id: clauseIdSchema.parse("class-syntax"),
      summary: "no authored class syntax",
      enforcedBy: "review",
    },
  ],
};

describe("CD-14 walker piece.json", () => {
  it("loads as the walker's CD-14 piece pointing class-syntax at its check module", () => {
    expect(
      readPieceFile({
        fileText,
        path: TABLE_PATH,
        ruleSetRoot: absolutePathSchema.parse("/install"),
        mechanism: mechanismIdSchema.parse("walker"),
        discipline: CD14,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        discipline: "CD-14",
        mechanism: "walker",
        clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
      },
    });
  });

  it("holds settings the walker runner accepts", () => {
    expect(walkerPieceSettingsSchema.safeParse(piece.clauses[0].settings)).toEqual({
      success: true,
      data: { module: "class-syntax.ts" },
    });
  });
});
