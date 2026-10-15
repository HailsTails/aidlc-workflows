import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPathPort, posixPathFlavour } from "../platform-ports/path-port.ts";
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

const outcome = pieceImportFindings({
  path: createPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/install/core/check" }),
  installRoot: ".",
  ruleSetRoots: [".", "./tests/probe-rule-set"],
  sources,
  typePackageTexts,
});

const piecesSchema = z.object({
  outcome: z.literal("ok"),
  value: z.object({ pieces: z.array(z.object({ file: z.string() }).loose()) }),
});

describe("FR-8 piece imports over what this repository's own piece source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("finds the install's CD-14 walker piece among the pieces it checks", () => {
    expect(piecesSchema.parse(outcome).value.pieces).toContainEqual({
      file: "./mechanisms/walker/CD-14/class-syntax.ts",
      ruleSetRoot: ".",
      mechanism: "walker",
      discipline: "CD-14",
    });
  });

  it("checks at least one piece file", () => {
    expect(piecesSchema.parse(outcome).value.pieces.length).toBeGreaterThan(0);
  });

  it("finds every piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});
