import { describe, expect, it } from "vitest";
import { createPathPort, windowsPathFlavour, posixPathFlavour } from "../platform-ports/path-port.ts";
import {
  type PieceLocation,
  pieceFilesOf,
  pieceImportFindings,
  pieceImportRefusals,
} from "./piece-import-rules.ts";

const INSTALL_ROOT = "plugins/discipline-core";
const PROBE_ROOT = "plugins/discipline-core/tests/probe-rule-set";

const path = createPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/fork" });

const WALKER_PIECE: PieceLocation = {
  file: "plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.ts",
  ruleSetRoot: INSTALL_ROOT,
  mechanism: "walker",
  discipline: "CD-14",
};

const NESTED_WALKER_PIECE: PieceLocation = {
  file: "plugins/discipline-core/mechanisms/walker/CD-14/nested/helper.ts",
  ruleSetRoot: INSTALL_ROOT,
  mechanism: "walker",
  discipline: "CD-14",
};

const PROBE_PIECE: PieceLocation = {
  file: "plugins/discipline-core/tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts",
  ruleSetRoot: PROBE_ROOT,
  mechanism: "walker",
  discipline: "PD-1",
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

  it("leaves out the runner folder of a mechanism", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [
          "plugins/discipline-core/mechanisms/walker/runner/create-walker-runner.ts",
          "plugins/discipline-core/mechanisms/walker/runner/walker-check.ts",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([]);
  });

  it("lists a file at any depth inside a piece folder", () => {
    expect(
      pieceFilesOf({
        trackedPaths: ["plugins/discipline-core/mechanisms/walker/CD-14/nested/helper.ts"],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([NESTED_WALKER_PIECE]);
  });

  it("lists a probe rule-set piece under the probe's own rule-set root", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [
          "plugins/discipline-core/tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts",
          "plugins/discipline-core/tests/probe-rule-set/rules/PD-1/discipline.json",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([PROBE_PIECE]);
  });

  it("tolerates a rule-set root with no tracked files", () => {
    expect(
      pieceFilesOf({
        trackedPaths: ["plugins/discipline-core/mechanisms/walker/CD-14/class-syntax.ts"],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([WALKER_PIECE]);
  });

  it("ignores files outside every rule-set root", () => {
    expect(
      pieceFilesOf({
        trackedPaths: [
          "plugins/discipline-core/core/check/run-check.ts",
          "plugins/discipline-core/rules/CD-14/discipline.json",
          "plugins/other/mechanisms/walker/CD-14/class-syntax.ts",
        ],
        ruleSetRoots: [INSTALL_ROOT, PROBE_ROOT],
      }),
    ).toEqual([]);
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

  it("a probe piece's relative type import of the install's runner", () => {
    expect(
      refusalsOf({
        piece: PROBE_PIECE,
        source: 'import type { WalkerCheck } from "../../../../../mechanisms/walker/runner/walker-check.ts";\n',
      }),
    ).toEqual([]);
  });

  it("a probe piece's relative import of the probe rule set's own discipline files", () => {
    expect(
      refusalsOf({
        piece: PROBE_PIECE,
        source: 'import discipline from "../../../rules/PD-1/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([]);
  });

  it("a probe piece's relative import of the install's core", () => {
    expect(
      refusalsOf({
        piece: PROBE_PIECE,
        source: 'import type { RepoPath } from "../../../../../core/values/repo-path.ts";\n',
      }),
    ).toEqual([]);
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

  it("a relative import of another discipline's rule files", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: 'import discipline from "../../../rules/CD-15/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([{ specifier: "../../../rules/CD-15/discipline.json", reason: "outside-piece-reach" }]);
  });

  it("a relative import of another mechanism's runner", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import { lintSourceCases } from "../../eslint/runner/eslint-instance.ts";\n' }),
    ).toEqual([{ specifier: "../../eslint/runner/eslint-instance.ts", reason: "outside-piece-reach" }]);
  });

  it("a relative import that leaves the install", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'import { audit } from "../../../../rin/tools/audit.ts";\n' }),
    ).toEqual([{ specifier: "../../../../rin/tools/audit.ts", reason: "outside-piece-reach" }]);
  });

  it("a re-export from outside the piece's reach", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'export { rule } from "../../eslint/CD-14/cd14.ts";\n' })).toEqual([
      { specifier: "../../eslint/CD-14/cd14.ts", reason: "outside-piece-reach" },
    ]);
  });

  it("a probe piece's relative import of an install piece", () => {
    expect(
      refusalsOf({
        piece: PROBE_PIECE,
        source: 'import { check } from "../../../../../mechanisms/walker/CD-14/class-syntax.ts";\n',
      }),
    ).toEqual([{ specifier: "../../../../../mechanisms/walker/CD-14/class-syntax.ts", reason: "outside-piece-reach" }]);
  });

  it("a probe piece's relative import of the install's rule files", () => {
    expect(
      refusalsOf({
        piece: PROBE_PIECE,
        source: 'import discipline from "../../../../../rules/PD-1/discipline.json" with { type: "json" };\n',
      }),
    ).toEqual([{ specifier: "../../../../../rules/PD-1/discipline.json", reason: "outside-piece-reach" }]);
  });

  it("a dynamic import inside the piece's own folder", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: 'export const load = () => import("./nested/helper.ts");\n' }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });

  it("a dynamic import of a computed specifier, named by its argument text", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source: "export const load = (modulePath: string) => import(modulePath);\n",
      }),
    ).toEqual([{ specifier: "modulePath", reason: "dynamic-import" }]);
  });

  it("a require call of a package its runner lists, as a dynamic import", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'const ts = require("typescript");\n' })).toEqual([
      { specifier: "typescript", reason: "dynamic-import" },
    ]);
  });

  it("a require call inside the piece's own folder, as a dynamic import", () => {
    expect(
      refusalsOf({ piece: WALKER_PIECE, source: "export const load = () => require ( './nested/helper.ts' );\n" }),
    ).toEqual([{ specifier: "./nested/helper.ts", reason: "dynamic-import" }]);
  });

  it("a value import of a package its runner lists", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import ts from "typescript";\n' })).toEqual([
      { specifier: "typescript", reason: "value-import-of-package" },
    ]);
  });

  it("a type import of a package its runner does not list", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import type { Rule } from "eslint";\n' })).toEqual([
      { specifier: "eslint", reason: "package-not-listed" },
    ]);
  });

  it("a node built-in module", () => {
    expect(refusalsOf({ piece: WALKER_PIECE, source: 'import { readFileSync } from "node:fs";\n' })).toEqual([
      { specifier: "node:fs", reason: "value-import-of-package" },
    ]);
  });

  it("only the refused imports of a file, in source order", () => {
    expect(
      refusalsOf({
        piece: WALKER_PIECE,
        source:
          'import type { WalkerCheck } from "../runner/walker-check.ts";\nimport { rule } from "../../eslint/CD-14/cd14.ts";\nimport type { Node } from "typescript";\nimport type { Rule } from "eslint";\n',
      }),
    ).toEqual([
      { specifier: "../../eslint/CD-14/cd14.ts", reason: "outside-piece-reach" },
      { specifier: "eslint", reason: "package-not-listed" },
    ]);
  });

  it("a type import of a package only another runner lists", () => {
    expect(
      pieceImportRefusals({
        path,
        installRoot: INSTALL_ROOT,
        piece: WALKER_PIECE,
        source: 'import type { Node } from "typescript";\n',
        typePackages: ["eslint"],
      }),
    ).toEqual([{ specifier: "typescript", reason: "package-not-listed" }]);
  });
});

const CLASS_SYNTAX_KEY = "../../mechanisms/walker/CD-14/class-syntax.ts";
const HELPER_KEY = "../../mechanisms/walker/CD-14/helper.ts";
const PROBE_KEY = "../../tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts";
const TYPE_PACKAGES_KEY = "../../mechanisms/walker/runner/piece-type-packages.json";

const SOURCES: Readonly<Record<string, string>> = {
  [CLASS_SYNTAX_KEY]: 'import type { Rule } from "eslint";\n',
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
        refusals: [{ file: CLASS_SYNTAX_KEY, specifier: "eslint", reason: "package-not-listed" }],
      },
    });
  });

  it("fails when a piece's runner has no piece type packages file", () => {
    expect(findingsOver({ typePackageTexts: {} })).toEqual({
      outcome: "failed",
      error: { kind: "type-packages-missing", path: TYPE_PACKAGES_KEY },
    });
  });

  it("fails when a runner's piece type packages list is empty", () => {
    expect(findingsOver({ typePackageTexts: { [TYPE_PACKAGES_KEY]: "[]" } })).toMatchObject({
      outcome: "failed",
      error: { kind: "type-packages-malformed", path: TYPE_PACKAGES_KEY },
    });
  });

  it("fails when a runner's piece type packages file is not JSON", () => {
    expect(findingsOver({ typePackageTexts: { [TYPE_PACKAGES_KEY]: "typescript" } })).toMatchObject({
      outcome: "failed",
      error: { kind: "type-packages-malformed", path: TYPE_PACKAGES_KEY },
    });
  });
});

describe("pieceImportFindings over sources keyed from the install root", () => {
  it("treats ./-prefixed keys under the install root \".\" as install pieces", () => {
    expect(
      pieceImportFindings({
        path,
        installRoot: ".",
        ruleSetRoots: [".", "./tests/probe-rule-set"],
        sources: { "./mechanisms/walker/CD-14/class-syntax.ts": 'import type { Rule } from "eslint";\n' },
        typePackageTexts: { "./mechanisms/walker/runner/piece-type-packages.json": '["typescript"]' },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        pieces: [
          { file: "./mechanisms/walker/CD-14/class-syntax.ts", ruleSetRoot: ".", mechanism: "walker", discipline: "CD-14" },
        ],
        refusals: [{ file: "./mechanisms/walker/CD-14/class-syntax.ts", specifier: "eslint", reason: "package-not-listed" }],
      },
    });
  });
});

const windowsPath = createPathPort({ flavour: windowsPathFlavour, workingDirectory: () => "C:\\fork" });

const WINDOWS_KEYED_PIECE: PieceLocation = {
  file: "mechanisms/walker/CD-14/a.ts",
  ruleSetRoot: ".",
  mechanism: "walker",
  discipline: "CD-14",
};

const WINDOWS_TYPE_PACKAGES_KEY = "mechanisms/walker/runner/piece-type-packages.json";

const windowsFindingsOver = (request: { readonly typePackageTexts: Readonly<Record<string, string>> }) =>
  pieceImportFindings({
    path: windowsPath,
    installRoot: ".",
    ruleSetRoots: ["."],
    sources: { [WINDOWS_KEYED_PIECE.file]: 'import type { WalkerCheck } from "../runner/x.ts";\n' },
    typePackageTexts: request.typePackageTexts,
  });

describe("piece import rules with a win32-flavoured path port", () => {
  it("allows a relative import of the piece's own mechanism runner", () => {
    expect(
      pieceImportRefusals({
        path: windowsPath,
        installRoot: ".",
        piece: WINDOWS_KEYED_PIECE,
        source: 'import type { WalkerCheck } from "../runner/x.ts";\n',
        typePackages: ["typescript"],
      }),
    ).toEqual([]);
  });

  it("names the missing piece type packages file by its forward-slashed repository path", () => {
    expect(windowsFindingsOver({ typePackageTexts: {} })).toEqual({
      outcome: "failed",
      error: { kind: "type-packages-missing", path: WINDOWS_TYPE_PACKAGES_KEY },
    });
  });

  it("names the malformed piece type packages file by its forward-slashed repository path", () => {
    expect(windowsFindingsOver({ typePackageTexts: { [WINDOWS_TYPE_PACKAGES_KEY]: "[]" } })).toMatchObject({
      outcome: "failed",
      error: { kind: "type-packages-malformed", path: WINDOWS_TYPE_PACKAGES_KEY },
    });
  });
});

const BACKSLASH_NAMED_PIECE: PieceLocation = {
  file: "mechanisms/walker/CD-14/a\\b.ts",
  ruleSetRoot: ".",
  mechanism: "walker",
  discipline: "CD-14",
};

describe("piece import rules with a win32-flavoured path port, a tracked name holding a backslash", () => {
  it("refuses a relative import of another discipline's piece from a piece whose file name holds a backslash", () => {
    expect(
      pieceImportRefusals({
        path: windowsPath,
        installRoot: ".",
        piece: BACKSLASH_NAMED_PIECE,
        source: 'import { check } from "../CD-15/no-for-of.ts";\n',
        typePackages: ["typescript"],
      }),
    ).toEqual([{ specifier: "../CD-15/no-for-of.ts", reason: "outside-piece-reach" }]);
  });

  it("allows a relative import of core from a piece whose file name holds a backslash", () => {
    expect(
      pieceImportRefusals({
        path: windowsPath,
        installRoot: ".",
        piece: BACKSLASH_NAMED_PIECE,
        source: 'import type { Result } from "../../../core/values/result.ts";\n',
        typePackages: ["typescript"],
      }),
    ).toEqual([]);
  });
});
