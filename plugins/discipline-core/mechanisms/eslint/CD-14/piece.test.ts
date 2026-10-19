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
import { eslintPieceSettingsSchema } from "../runner/eslint-piece-settings-schema.ts";
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
    {
      kind: "judgement",
      id: clauseIdSchema.parse("static-only-class"),
      summary: "no class holding only static members",
      enforcedBy: "review",
    },
  ],
};

describe("CD-14 ESLint piece.json", () => {
  it("loads as the ESLint CD-14 piece pointing class-syntax at no-class-authoring and static-only-class at no-extraneous-class with Biome's noStaticOnlyClass reach", () => {
    expect(
      readPieceFile({
        fileText,
        path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
        ruleSetRoot: absolutePathSchema.parse("/install"),
        mechanism: mechanismIdSchema.parse("eslint"),
        discipline: CD14,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        version: 1,
        discipline: "CD-14",
        mechanism: "eslint",
        clauses: [
          {
            clause: "class-syntax",
            settings: {
              pluginNamespace: "discipline",
              pluginModule: "cd14/cd14.eslint-plugin.ts",
              rule: "no-class-authoring",
            },
          },
          {
            clause: "static-only-class",
            settings: {
              pluginNamespace: "discipline",
              pluginModule: "cd14/cd14.eslint-plugin.ts",
              rule: "no-extraneous-class",
              options: [{ allowConstructorOnly: true, allowEmpty: true, allowStaticOnly: false, allowWithDecorator: true }],
            },
          },
        ],
      },
    });
  });

  it("holds settings the ESLint runner accepts", () => {
    expect(eslintPieceSettingsSchema.safeParse(piece.clauses[0].settings)).toEqual({
      success: true,
      data: {
        pluginNamespace: "discipline",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
        rule: "no-class-authoring",
      },
    });
  });
});
