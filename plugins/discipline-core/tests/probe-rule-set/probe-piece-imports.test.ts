import { describe, expect, it, vi } from "vitest";
import { pieceImportFindings } from "../../core/check/piece-import-rules.ts";
import type { PathPort } from "../../core/platform-ports/path-port.ts";
import { requiredEntry } from "../required-entry.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sources = import.meta.glob(
  ["./tests/probe-rule-set/mechanisms/*/*/**/*.ts", "!./tests/probe-rule-set/mechanisms/*/*/**/*.test.ts"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const typePackageTexts = import.meta.glob(["./mechanisms/*/runner/piece-type-packages.json"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const JOINED_REPOSITORY_PATHS: Readonly<Record<string, string>> = {
  '["./mechanisms/eslint/runner/piece-type-packages.json"]': "mechanisms/eslint/runner/piece-type-packages.json",
  '[".","mechanisms","walker","runner","piece-type-packages.json"]': "mechanisms/walker/runner/piece-type-packages.json",
  '["./mechanisms/walker/runner/piece-type-packages.json"]': "mechanisms/walker/runner/piece-type-packages.json",
  '["./tests/probe-rule-set","mechanisms","walker","PD-1"]': "tests/probe-rule-set/mechanisms/walker/PD-1",
  '["./tests/probe-rule-set","rules","PD-1"]': "tests/probe-rule-set/rules/PD-1",
  '[".","mechanisms","walker","runner"]': "mechanisms/walker/runner",
  '[".","core"]': "core",
  '["./tests/probe-rule-set/mechanisms/walker/PD-1","../../../../../mechanisms/walker/runner/walker-piece.ts"]':
    "mechanisms/walker/runner/walker-piece.ts",
};

const REPOSITORY_DIRECTORIES: Readonly<Record<string, string>> = {
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
  ruleSetRoots: ["./tests/probe-rule-set"],
  sources,
  typePackageTexts,
});

describe("FR-8 piece imports over the probe rule set's own piece source, shipped with the probe so the check without it stays green", () => {
  it("finds the probe rule set's PD-1 walker piece among the pieces it checks", () => {
    expect(outcome).toMatchObject({
      outcome: "ok",
      value: {
        pieces: expect.arrayContaining([
          {
            file: "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts",
            ruleSetRoot: "./tests/probe-rule-set",
            mechanism: "walker",
            discipline: "PD-1",
          },
        ]),
      },
    });
  });

  it("finds every probe piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});
