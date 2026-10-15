import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
import {
  type PieceLocation,
  pieceFilesOf,
  pieceImportFindings,
  pieceImportRefusals,
} from "./piece-import-rules.ts";

const INSTALL_ROOT = "plugins/discipline-core";
const PROBE_ROOT = "plugins/discipline-core/tests/probe-rule-set";

const path = createPathPort({ flavour: "posix", workingDirectory: () => "/fork" });

const WALKER_PIECE: PieceLocation = {
  file: "plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.ts",
  ruleSetRoot: INSTALL_ROOT,
  mechanism: "walker",
  discipline: "CD-14",
};

const refusalsOf = (request: {
  readonly piece: PieceLocation;
  readonly source: string;
}) =>
  pieceImportRefusals({
    path,
    installRoot: INSTALL_ROOT,
    piece: request.piece,
    source: request.source,
    typePackages: ["typescript"],
  });

describe("pieceFilesOf", () => {
  it("lists a non-test TypeScript file in an install piece folder with its rule set, mechanism and discipline", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [
          "plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.ts",
          "plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.test.ts",
          "plugins/discipline-core/mechanisms/walker/CD-14/piece.json",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([WALKER_PIECE]);
  });
});

describe("pieceImportRefusals allows", () => {
  it("a relative import inside the piece's own folder", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { helper } from "./nested/helper.ts";\n' })).toEqual([]);
  });

  it("a relative import of the piece's own mechanism runner", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { WalkerCheck } from "../runner/walker-check.ts";\n' }),
    ).toEqual([]);
  });

  it("a relative import of core", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import type { Result } from "../../../core/values/result.ts";\n' }),
    ).toEqual([]);
  });

  it("a relative import of its own discipline's rule files", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import discipline from "../../../rules/CD-14/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([]);
  });

  it("a type import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import type { Node } from "typescript";\n' })).toEqual([]);
  });
});

describe("pieceImportRefusals refuses", () => {
  it("a relative import of another mechanism's piece for the same discipline", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { rule } from "../../eslint/CD-14/cd14.ts";\n' })).toEqual([
      { specifier: "../../eslint/CD-14/cd14.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a relative import of another discipline's piece in the same mechanism", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { check } from "../CD-15/no-for-of.ts";\n' })).toEqual([
      { specifier: "../CD-15/no-for-of.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a relative import of another mechanism's runner", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import { lintSourceCases } from "../../eslint/runner/eslint-instance.ts";\n' }),
    ).toEqual([{ specifier: "../../eslint/runner/eslint-instance.ts", reason: "outside-piece-reach" }]);
  });

  it("a dynamic import inside the piece's own folder", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'export const load = () => import("./nested/helper.ts");\n' }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });

  it("a value import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import ts from "typescript";\n' })).toEqual([
      { specifier: "typescript", reason: "value-import-of-package" },
    ]);
  });

  it("a type import of a package its runner does not list", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import type { Program } from "acorn";\n' })).toEqual([
      { specifier: "acorn", reason: "package-not-listed" },
    ]);
  });
});

const CLASS_SYNTAX_KEY = "../../mechanisms/walker/CD-14/class-syntax.ts";
const HELPER_KEY = "../../mechanisms/walker/CD-14/helper.ts";
const PROBE_KEY = "../../tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts";
const TYPE_PACKAGES_KEY = "../../mechanisms/walker/runner/piece-type-packages.json";

const SOURCES: Readonly<Record<string, string>> = {
  [CLASS_SYNTAX_KEY]: 'import type { Program } from "acorn";\n',
  [HELPER_KEY]: 'import type { Node } from "typescript";\n',
  [PROBE_KEY]: 'import type { WalkerCheck } from "../../../../../mechanisms/walker/runner/walker-check.ts";\n',
};

const findingsOver = (request: { readonly typePackageTexts: Readonly<Record<string, string>> }) =>
  pieceImportFindings({
    path,
    installRoot: "../..",
    ruleSetRoots: ["../..", "../../tests/probe-rule-set"],
    sources: SOURCES,
    typePackageTexts: request.typePackageTexts,
  });

describe("pieceImportFindings", () => {
  it("lists every piece in the sources and each refused import with its file", () => {
    expect(findingsOver({ typePackageTexts: { [TYPE_PACKAGES_KEY]: '["typescript"]' } })).toEqual({
      outcome: "ok",
      value: {
        pieces: [
          { file: CLASS_SYNTAX_KEY, ruleSetRoot: "../..", mechanism: "walker", discipline: "CD-14" },
          { file: HELPER_KEY, ruleSetRoot: "../..", mechanism: "walker", discipline: "CD-14" },
          { file: PROBE_KEY, ruleSetRoot: "../../tests/probe-rule-set", mechanism: "walker", discipline: "PD-1" },
        ],
        refusals: [{ file: CLASS_SYNTAX_KEY, specifier: "acorn", reason: "package-not-listed" }],
      },
    });
  });

  it("fails when a piece's runner has no piece type packages file", () => {
    expect(findingsOver({ typePackageTexts: {} })).toEqual({
      outcome: "failed",
      error: { kind: "type-packages-missing", path: TYPE_PACKAGES_KEY },
    });
  });
});
