import { describe, expect, it } from "vitest";
import { z } from "zod";
import { pieceImportFindings } from "../../core/check/piece-import-rules.ts";
import { createPathPort } from "../../core/platform-ports/path-port.ts";

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

const outcome = pieceImportFindings({
  path: createPathPort({ workingDirectory: () => "/install/tests/probe-rule-set" }),
  installRoot: ".",
  ruleSetRoots: ["./tests/probe-rule-set"],
  sources,
  typePackageTexts,
});

const piecesSchema = z.object({
  outcome: z.literal("ok"),
  value: z.object({ pieces: z.array(z.object({ file: z.string() }).loose()) }),
});

describe("FR-8 piece imports over the probe rule set's own piece source, shipped with the probe so the check without it stays green", () => {
  it("finds the probe rule set's PD-1 walker piece among the pieces it checks", () => {
    expect(piecesSchema.parse(outcome).value.pieces).toContainEqual({
      file: "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts",
      ruleSetRoot: "./tests/probe-rule-set",
      mechanism: "walker",
      discipline: "PD-1",
    });
  });

  it("finds every probe piece import inside the piece's reach", () => {
    expect(outcome).toMatchObject({ outcome: "ok", value: { refusals: [] } });
  });
});
