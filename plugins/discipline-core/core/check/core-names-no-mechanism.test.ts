import { describe, expect, it } from "vitest";
import { installNamingFindings } from "./install-naming.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sources = import.meta.glob(
  ["./core/**/*.ts", "!./core/**/*.test.ts", "./mechanisms/*/runner/*", "!./mechanisms/*/runner/*.test.ts"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const disciplineFiles = import.meta.glob(["./rules/*/discipline.json"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const findings = installNamingFindings({ installRoot: ".", sources, disciplineFiles });

describe("FR-8 naming over what this repository's own core and runner source names, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("scans the install's mechanisms, disciplines, core files and runner files", () => {
    expect(findings.scope).toMatchObject({
      mechanisms: expect.arrayContaining(["audit"]),
      disciplines: expect.arrayContaining(["CD-14"]),
      coreFiles: expect.arrayContaining(["./core/check/run-check.ts"]),
      runnerFiles: expect.arrayContaining(["./mechanisms/audit/runner/create-walker-runner.ts"]),
    });
  });

  it("finds no core file naming a mechanism or a discipline", () => {
    expect(findings.coreNaming).toEqual([]);
  });

  it("finds no runner file naming a discipline", () => {
    expect(findings.runnerNaming).toEqual([]);
  });

  it("finds no core file importing a mechanism or rules folder", () => {
    expect(findings.coreReach).toEqual([]);
  });
});
