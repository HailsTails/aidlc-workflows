import { describe, expect, it } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
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
import { walkerPieceSettingsSchema } from "../runner/walker-check-schema.ts";
import piece from "./piece.json" with { type: "json" };

const fileText: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify(piece) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
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
        path: createPathPort({ workingDirectory: () => "/install" }),
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
