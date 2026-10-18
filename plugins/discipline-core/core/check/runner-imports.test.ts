import { describe, expect, it } from "vitest";
import {
  filesNotMatching,
  importsOutside,
  packageImport,
  packageOrComputedImport,
  relativeImportOfAnyForm,
  relativeImportReaching,
} from "../../tests/confinement.ts";

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

const walkerRunnerSources = import.meta.glob(["./mechanisms/walker/runner/*.ts", "!./mechanisms/walker/runner/*.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintRunnerSources = import.meta.glob(["./mechanisms/eslint/runner/*.ts", "!./mechanisms/eslint/runner/*.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const vendorImportsTestSources = import.meta.glob(["./core/check/vendor-imports.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerRunnerReach = relativeImportReaching({
  importingFolder: "mechanisms/walker/runner",
  reach: /^(?:mechanisms\/walker\/runner\/|core\/(?:mechanism-port|values|platform-ports|rule-set-reader|exception-records)\/)/,
});

const eslintRunnerReach = relativeImportReaching({
  importingFolder: "mechanisms/eslint/runner",
  reach: /^(?:mechanisms\/eslint\/runner\/|core\/(?:mechanism-port|values|platform-ports|rule-set-reader|exception-records)\/)/,
});

const vitestImport = packageImport({ packageName: "vitest" });

const REACHES_ONLY_NAMED_CORE_FOLDERS =
  /^(?!.*(?:\bfrom|\bimport)\s*\(?\s*["'](?:\.\.\/)+core\/(?!(?:mechanism-port|values|platform-ports|rule-set-reader|exception-records)\/)).*$/s;

const TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS =
  /^(?!.*(?:\b(?:import|export)\s+(?!type\s)[^;]*?\bfrom\s*|\bimport\s*\(?\s*)["'](?:\.\.\/)+core\/exception-records\/).*$/s;


describe("FR-8 and AR-1 runner reach into core and its own mechanism over what this repository's own runner source imports, read as build-time raw modules (CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file through every scanned set, so no set is silently empty", () => {
    expect({ runnerSources, walkerRunnerSources, eslintRunnerSources }).toEqual({
      runnerSources: expect.objectContaining({
        "./mechanisms/walker/runner/create-walker-runner.ts": expect.any(String),
        "./mechanisms/eslint/runner/create-eslint-runner.ts": expect.any(String),
      }),
      walkerRunnerSources: expect.objectContaining({ "./mechanisms/walker/runner/create-walker-runner.ts": expect.any(String) }),
      eslintRunnerSources: expect.objectContaining({ "./mechanisms/eslint/runner/create-eslint-runner.ts": expect.any(String) }),
    });
  });

  it("finds every runner file importing from core only mechanism-port, values, platform-ports, rule-set-reader, and types from exception-records", () => {
    expect({
      importingACoreFolderOutsideTheNamedFolders: filesNotMatching({
        sources: runnerSources,
        pattern: REACHES_ONLY_NAMED_CORE_FOLDERS,
      }),
      importingAValueFromExceptionRecords: filesNotMatching({
        sources: runnerSources,
        pattern: TAKES_ONLY_TYPES_FROM_EXCEPTION_RECORDS,
      }),
    }).toEqual({ importingACoreFolderOutsideTheNamedFolders: [], importingAValueFromExceptionRecords: [] });
  });

  it("finds every walker runner import resolving inside the walker runner or core's named folders", () => {
    expect(
      importsOutside({ sources: walkerRunnerSources, allowed: [walkerRunnerReach, packageOrComputedImport] }),
    ).toEqual([]);
  });

  it("finds every ESLint runner import resolving inside the ESLint runner or core's named folders", () => {
    expect(
      importsOutside({ sources: eslintRunnerSources, allowed: [eslintRunnerReach, packageOrComputedImport] }),
    ).toEqual([]);
  });
});

describe("the test-import confinement check's own file, which its glob cannot include, read here as a build-time raw module (CD-47: that source is the assertion's subject; nothing is spawned or written)", () => {
  it("finds core/check/vendor-imports.test.ts importing only relative paths and vitest, type-only imports included", () => {
    expect({
      scanned: vendorImportsTestSources,
      importsOutside: importsOutside({
        sources: vendorImportsTestSources,
        allowed: [relativeImportOfAnyForm, vitestImport],
      }),
    }).toEqual({ scanned: { "./core/check/vendor-imports.test.ts": expect.any(String) }, importsOutside: [] });
  });
});
