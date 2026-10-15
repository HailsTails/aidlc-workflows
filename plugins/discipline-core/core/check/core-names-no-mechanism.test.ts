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
  it("derives the walker among the install's mechanism ids", () => {
    expect(findings.scope.mechanisms).toContain("walker");
  });

  it("derives CD-14 among the install's discipline ids", () => {
    expect(findings.scope.disciplines).toContain("CD-14");
  });

  it("scans core's check dispatch among core's files", () => {
    expect(findings.scope.coreFiles).toContain("./core/check/run-check.ts");
  });

  it("scans the walker runner factory among the runner files", () => {
    expect(findings.scope.runnerFiles).toContain("./mechanisms/walker/runner/create-walker-runner.ts");
  });

  it("checks at least one core file", () => {
    expect(findings.scope.coreFiles.length).toBeGreaterThan(0);
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
