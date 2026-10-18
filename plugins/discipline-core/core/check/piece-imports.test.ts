import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { pieceImportFindings } from "./piece-import-rules.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sources = import.meta.glob(
  [
    "./mechanisms/*/*/**/*.ts",
    "!./mechanisms/*/*/**/*.test.ts",
    "./tests/probe-rule-set/mechanisms/*/*/**/*.ts",
    "!./tests/probe-rule-set/mechanisms/*/*/**/*.test.ts",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const typePackageTexts = import.meta.glob(["./mechanisms/*/runner/piece-type-packages.json"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const JOINED_REPOSITORY_PATHS: Readonly<Record<string, string>> = {
  '[".","mechanisms","walker","CD-1"]': "mechanisms/walker/CD-1",
  '[".","rules","CD-1"]': "rules/CD-1",
  '["./mechanisms/walker/CD-1","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '["./mechanisms/walker/CD-1","../runner/typescript-parse.ts"]': "mechanisms/walker/runner/typescript-parse.ts",
  '[".","mechanisms","walker","CD-2"]': "mechanisms/walker/CD-2",
  '[".","rules","CD-2"]': "rules/CD-2",
  '["./mechanisms/walker/CD-2","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '["./mechanisms/walker/CD-2","../runner/typescript-parse.ts"]': "mechanisms/walker/runner/typescript-parse.ts",
  '[".","mechanisms","walker","CD-5"]': "mechanisms/walker/CD-5",
  '[".","rules","CD-5"]': "rules/CD-5",
  '["./mechanisms/walker/CD-5","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '[".","mechanisms","walker","CD-6"]': "mechanisms/walker/CD-6",
  '[".","rules","CD-6"]': "rules/CD-6",
  '["./mechanisms/walker/CD-6","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '[".","mechanisms","walker","CD-7"]': "mechanisms/walker/CD-7",
  '[".","rules","CD-7"]': "rules/CD-7",
  '["./mechanisms/walker/CD-7","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '[".","mechanisms","walker","CD-7a"]': "mechanisms/walker/CD-7a",
  '[".","rules","CD-7a"]': "rules/CD-7a",
  '["./mechanisms/walker/CD-7a","../runner/walker-piece.ts"]': "mechanisms/walker/runner/walker-piece.ts",
  '[".","mechanisms","eslint","runner","piece-type-packages.json"]': "mechanisms/eslint/runner/piece-type-packages.json",
  '["./mechanisms/eslint/runner/piece-type-packages.json"]': "mechanisms/eslint/runner/piece-type-packages.json",
  '[".","mechanisms","walker","CD-14"]': "mechanisms/walker/CD-14",
  '[".","rules","CD-14"]': "rules/CD-14",
  '["./mechanisms/walker/CD-14","../runner/typescript-parse.ts"]': "mechanisms/walker/runner/typescript-parse.ts",
  '[".","mechanisms","walker","runner","piece-type-packages.json"]': "mechanisms/walker/runner/piece-type-packages.json",
  '["./mechanisms/walker/runner/piece-type-packages.json"]': "mechanisms/walker/runner/piece-type-packages.json",
  '["./tests/probe-rule-set","mechanisms","walker","PD-1"]': "tests/probe-rule-set/mechanisms/walker/PD-1",
  '["./tests/probe-rule-set","rules","PD-1"]': "tests/probe-rule-set/rules/PD-1",
  '[".","mechanisms","walker","runner"]': "mechanisms/walker/runner",
  '[".","core"]': "core",
  '["./tests/probe-rule-set/mechanisms/walker/PD-1","../../../../../mechanisms/walker/runner/walker-check.ts"]':
    "mechanisms/walker/runner/walker-check.ts",
};

const REPOSITORY_DIRECTORIES: Readonly<Record<string, string>> = {
  "./mechanisms/walker/CD-1/any-cast.ts": "./mechanisms/walker/CD-1",
  "./mechanisms/walker/CD-2/cast-expressions.ts": "./mechanisms/walker/CD-2",
  "./mechanisms/walker/CD-5/comments-directives.ts": "./mechanisms/walker/CD-5",
  "./mechanisms/walker/CD-6/identifier-names.ts": "./mechanisms/walker/CD-6",
  "./mechanisms/walker/CD-7/categorical-paths.ts": "./mechanisms/walker/CD-7",
  "./mechanisms/walker/CD-7a/factory-return-types.ts": "./mechanisms/walker/CD-7a",
  "./mechanisms/walker/CD-14/class-syntax.ts": "./mechanisms/walker/CD-14",
  "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts": "./tests/probe-rule-set/mechanisms/walker/PD-1",
};

const TABLE_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: ({ segments }) => requiredEntry({ table: JOINED_REPOSITORY_PATHS, key: JSON.stringify(segments) }),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: ({ path }) => requiredEntry({ table: REPOSITORY_DIRECTORIES, key: path }),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const outcome = pieceImportFindings({
  path: TABLE_PATH,
  installRoot: ".",
  ruleSetRoots: [".", "./tests/probe-rule-set"],
  sources,
  typePackageTexts,
});

describe("FR-8 piece imports over what this repository's own piece source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("finds the install's CD-14 walker piece among the pieces it checks", () => {
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        pieces: expect.arrayContaining([
          { file: "./mechanisms/walker/CD-14/class-syntax.ts", ruleSetRoot: ".", mechanism: "walker", discipline: "CD-14" },
        ]),
      },
    });
  });

  it("finds every piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});
