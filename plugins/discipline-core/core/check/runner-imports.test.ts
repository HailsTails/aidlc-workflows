import { describe, expect, it } from "vitest";
import { z } from "zod";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const runnerSources = import.meta.glob(["./mechanisms/*/runner/**/*.ts", "!./mechanisms/*/runner/**/*.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const REACHES_ONLY_NAMED_CORE_FOLDERS =
  /^(?!.*(?:\bfrom|\bimport)\s*\(?\s*["'](?:\.\.\/)+core\/(?!(?:mechanism-port|values|platform-ports|rule-set-reader|exception-records)\/)).*$/s;

const TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS =
  /^(?!.*(?:\b(?:import|export)\s+(?!type\s)[^;]*?\bfrom\s*|\bimport\s*\(?\s*)["'](?:\.\.\/)+core\/exception-records\/).*$/s;

const runnerSourceWithinCoreReach = z
  .string()
  .regex(
    REACHES_ONLY_NAMED_CORE_FOLDERS,
    "imports a core folder outside mechanism-port, values, platform-ports, rule-set-reader and exception-records",
  )
  .regex(TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS, "imports a value from core/exception-records");

const runnerSourcesWithinCoreReach = z.record(z.string(), runnerSourceWithinCoreReach);

describe("FR-8 runner reach into core over what this repository's own runner source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads the walker runner factory among the runner files", () => {
    expect(runnerSources).toEqual(expect.objectContaining({ "./mechanisms/walker/runner/create-walker-runner.ts": expect.any(String) }));
  });

  it("reads the ESLint runner factory among the runner files", () => {
    expect(runnerSources).toEqual(expect.objectContaining({ "./mechanisms/eslint/runner/create-eslint-runner.ts": expect.any(String) }));
  });

  it("finds every runner file importing from core only mechanism-port, values, platform-ports, rule-set-reader, and types from exception-records", () => {
    expect(runnerSourcesWithinCoreReach.safeParse(runnerSources).error).toBeUndefined();
  });
});
