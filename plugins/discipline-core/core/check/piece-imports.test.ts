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
  '[".","mechanisms","audit","CD-17"]': "mechanisms/audit/CD-17",
  '[".","rules","CD-17"]': "rules/CD-17",
  '["./mechanisms/audit/CD-17","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-17","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-19"]': "mechanisms/audit/CD-19",
  '[".","rules","CD-19"]': "rules/CD-19",
  '["./mechanisms/audit/CD-19","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-19","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '["./mechanisms/audit/CD-19","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '[".","mechanisms","audit","CD-1"]': "mechanisms/audit/CD-1",
  '[".","rules","CD-1"]': "rules/CD-1",
  '["./mechanisms/audit/CD-1","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-1","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '["./mechanisms/audit/CD-1","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '[".","mechanisms","audit","CD-2"]': "mechanisms/audit/CD-2",
  '[".","rules","CD-2"]': "rules/CD-2",
  '["./mechanisms/audit/CD-2","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-2","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '["./mechanisms/audit/CD-2","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '[".","mechanisms","audit","CD-5"]': "mechanisms/audit/CD-5",
  '[".","rules","CD-5"]': "rules/CD-5",
  '["./mechanisms/audit/CD-5","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-5","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-6"]': "mechanisms/audit/CD-6",
  '[".","rules","CD-6"]': "rules/CD-6",
  '["./mechanisms/audit/CD-6","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-6","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-7"]': "mechanisms/audit/CD-7",
  '[".","rules","CD-7"]': "rules/CD-7",
  '["./mechanisms/audit/CD-7","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-7","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-7a"]': "mechanisms/audit/CD-7a",
  '[".","rules","CD-7a"]': "rules/CD-7a",
  '["./mechanisms/audit/CD-7a","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-7a","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-8"]': "mechanisms/audit/CD-8",
  '[".","rules","CD-8"]': "rules/CD-8",
  '["./mechanisms/audit/CD-8","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-8","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-15"]': "mechanisms/audit/CD-15",
  '[".","rules","CD-15"]': "rules/CD-15",
  '["./mechanisms/audit/CD-15","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-15","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-10"]': "mechanisms/audit/CD-10",
  '[".","rules","CD-10"]': "rules/CD-10",
  '["./mechanisms/audit/CD-10","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-10","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-23"]': "mechanisms/audit/CD-23",
  '[".","rules","CD-23"]': "rules/CD-23",
  '["./mechanisms/audit/CD-23","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-23","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-25"]': "mechanisms/audit/CD-25",
  '[".","rules","CD-25"]': "rules/CD-25",
  '["./mechanisms/audit/CD-25","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-25","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-26"]': "mechanisms/audit/CD-26",
  '[".","rules","CD-26"]': "rules/CD-26",
  '["./mechanisms/audit/CD-26","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-26","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-27"]': "mechanisms/audit/CD-27",
  '[".","rules","CD-27"]': "rules/CD-27",
  '["./mechanisms/audit/CD-27","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-27","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-47"]': "mechanisms/audit/CD-47",
  '[".","rules","CD-47"]': "rules/CD-47",
  '["./mechanisms/audit/CD-47","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-47","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","CD-43"]': "mechanisms/audit/CD-43",
  '[".","rules","CD-43"]': "rules/CD-43",
  '["./mechanisms/audit/CD-43","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-43","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '["./mechanisms/audit/CD-43","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '[".","mechanisms","audit","CD-44"]': "mechanisms/audit/CD-44",
  '[".","rules","CD-44"]': "rules/CD-44",
  '["./mechanisms/audit/CD-44","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-44","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '["./mechanisms/audit/CD-44","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '[".","mechanisms","audit","CD-3"]': "mechanisms/audit/CD-3",
  '[".","rules","CD-3"]': "rules/CD-3",
  '["./mechanisms/audit/CD-3","../runner/jsonc-parse.ts"]': "mechanisms/audit/runner/jsonc-parse.ts",
  '["./mechanisms/audit/CD-3","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-3","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","eslint","runner","piece-type-packages.json"]': "mechanisms/eslint/runner/piece-type-packages.json",
  '["./mechanisms/eslint/runner/piece-type-packages.json"]': "mechanisms/eslint/runner/piece-type-packages.json",
  '[".","mechanisms","eslint","runner"]': "mechanisms/eslint/runner",
  '[".","mechanisms","eslint","CD-1"]': "mechanisms/eslint/CD-1",
  '["./mechanisms/eslint/CD-1/cd1","../../runner/native-rules.ts"]': "mechanisms/eslint/runner/native-rules.ts",
  '[".","mechanisms","eslint","CD-6"]': "mechanisms/eslint/CD-6",
  '["./mechanisms/eslint/CD-6/cd6","../../runner/native-rules.ts"]': "mechanisms/eslint/runner/native-rules.ts",
  '[".","mechanisms","eslint","CD-14"]': "mechanisms/eslint/CD-14",
  '["./mechanisms/eslint/CD-14/cd14","../../runner/native-rules.ts"]': "mechanisms/eslint/runner/native-rules.ts",
  '[".","mechanisms","eslint","CD-40"]': "mechanisms/eslint/CD-40",
  '[".","rules","CD-40"]': "rules/CD-40",
  '["./mechanisms/eslint/CD-40/cd40","../../runner/native-rules.ts"]': "mechanisms/eslint/runner/native-rules.ts",
  '[".","mechanisms","eslint","CD-44"]': "mechanisms/eslint/CD-44",
  '["./mechanisms/eslint/CD-44/cd44","../../runner/native-rules.ts"]': "mechanisms/eslint/runner/native-rules.ts",
  '["./mechanisms/eslint/CD-1/cd1","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","eslint","CD-7"]': "mechanisms/eslint/CD-7",
  '["./mechanisms/eslint/CD-7/cd7","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","eslint","CD-10"]': "mechanisms/eslint/CD-10",
  '["./mechanisms/eslint/CD-10/cd10","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","eslint","CD-27"]': "mechanisms/eslint/CD-27",
  '["./mechanisms/eslint/CD-27/cd27","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","eslint","CD-41"]': "mechanisms/eslint/CD-41",
  '[".","rules","CD-41"]': "rules/CD-41",
  '["./mechanisms/eslint/CD-41/cd41","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","eslint","CD-42"]': "mechanisms/eslint/CD-42",
  '[".","rules","CD-42"]': "rules/CD-42",
  '["./mechanisms/eslint/CD-42/cd42","../../runner/eslint-instance.ts"]': "mechanisms/eslint/runner/eslint-instance.ts",
  '[".","mechanisms","audit","CD-14"]': "mechanisms/audit/CD-14",
  '[".","rules","CD-14"]': "rules/CD-14",
  '["./mechanisms/audit/CD-14","../runner/typescript-parse.ts"]': "mechanisms/audit/runner/typescript-parse.ts",
  '["./mechanisms/audit/CD-14","../runner/walker-piece.ts"]': "mechanisms/audit/runner/walker-piece.ts",
  '["./mechanisms/audit/CD-14","../runner/source-scope.ts"]': "mechanisms/audit/runner/source-scope.ts",
  '[".","mechanisms","audit","runner","piece-type-packages.json"]': "mechanisms/audit/runner/piece-type-packages.json",
  '["./mechanisms/audit/runner/piece-type-packages.json"]': "mechanisms/audit/runner/piece-type-packages.json",
  '["./tests/probe-rule-set","mechanisms","audit","PD-1"]': "tests/probe-rule-set/mechanisms/audit/PD-1",
  '["./tests/probe-rule-set","rules","PD-1"]': "tests/probe-rule-set/rules/PD-1",
  '[".","mechanisms","audit","runner"]': "mechanisms/audit/runner",
  '[".","core"]': "core",
  '["./tests/probe-rule-set/mechanisms/audit/PD-1","../../../../../mechanisms/audit/runner/walker-piece.ts"]':
    "mechanisms/audit/runner/walker-piece.ts",
};

const REPOSITORY_DIRECTORIES: Readonly<Record<string, string>> = {
  "./mechanisms/audit/CD-17/clock-sources.ts": "./mechanisms/audit/CD-17",
  "./mechanisms/audit/CD-19/import-boundaries.ts": "./mechanisms/audit/CD-19",
  "./mechanisms/audit/CD-1/any-cast.ts": "./mechanisms/audit/CD-1",
  "./mechanisms/audit/CD-2/cast-expressions.ts": "./mechanisms/audit/CD-2",
  "./mechanisms/audit/CD-5/comments-directives.ts": "./mechanisms/audit/CD-5",
  "./mechanisms/audit/CD-6/identifier-names.ts": "./mechanisms/audit/CD-6",
  "./mechanisms/audit/CD-7/categorical-paths.ts": "./mechanisms/audit/CD-7",
  "./mechanisms/audit/CD-7a/factory-return-types.ts": "./mechanisms/audit/CD-7a",
  "./mechanisms/audit/CD-8/switch-defaults.ts": "./mechanisms/audit/CD-8",
  "./mechanisms/audit/CD-15/loops.ts": "./mechanisms/audit/CD-15",
  "./mechanisms/audit/CD-10/throws-in-tests.ts": "./mechanisms/audit/CD-10",
  "./mechanisms/audit/CD-23/export-test-sibling.ts": "./mechanisms/audit/CD-23",
  "./mechanisms/audit/CD-25/dependency-isolation.ts": "./mechanisms/audit/CD-25",
  "./mechanisms/audit/CD-26/module-mocking.ts": "./mechanisms/audit/CD-26",
  "./mechanisms/audit/CD-27/test-body-logic.ts": "./mechanisms/audit/CD-27",
  "./mechanisms/audit/CD-47/hermetic-git-spawns.ts": "./mechanisms/audit/CD-47",
  "./mechanisms/audit/CD-43/boolean-signatures.ts": "./mechanisms/audit/CD-43",
  "./mechanisms/audit/CD-44/parameter-mutation.ts": "./mechanisms/audit/CD-44",
  "./mechanisms/audit/CD-3/compiler-overrides.ts": "./mechanisms/audit/CD-3",
  "./mechanisms/audit/CD-14/class-syntax.ts": "./mechanisms/audit/CD-14",
  "./mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.ts": "./mechanisms/eslint/CD-1/cd1",
  "./mechanisms/eslint/CD-6/cd6/cd6.eslint-plugin.ts": "./mechanisms/eslint/CD-6/cd6",
  "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts": "./mechanisms/eslint/CD-14/cd14",
  "./mechanisms/eslint/CD-40/cd40/cd40.eslint-plugin.ts": "./mechanisms/eslint/CD-40/cd40",
  "./mechanisms/eslint/CD-44/cd44/cd44.eslint-plugin.ts": "./mechanisms/eslint/CD-44/cd44",
  "./mechanisms/eslint/CD-7/cd7/cd7.eslint-plugin.ts": "./mechanisms/eslint/CD-7/cd7",
  "./mechanisms/eslint/CD-10/cd10/cd10.eslint-plugin.ts": "./mechanisms/eslint/CD-10/cd10",
  "./mechanisms/eslint/CD-27/cd27/cd27.eslint-plugin.ts": "./mechanisms/eslint/CD-27/cd27",
  "./mechanisms/eslint/CD-41/cd41/cd41.eslint-plugin.ts": "./mechanisms/eslint/CD-41/cd41",
  "./mechanisms/eslint/CD-42/cd42/cd42.eslint-plugin.ts": "./mechanisms/eslint/CD-42/cd42",
  "./tests/probe-rule-set/mechanisms/audit/PD-1/no-tmp-files.ts": "./tests/probe-rule-set/mechanisms/audit/PD-1",
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
  it("finds the install's CD-14 audit piece among the pieces it checks", () => {
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        pieces: expect.arrayContaining([
          { file: "./mechanisms/audit/CD-14/class-syntax.ts", ruleSetRoot: ".", mechanism: "audit", discipline: "CD-14" },
        ]),
      },
    });
  });

  it("finds every piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});
