import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPathPort, posixPathFlavour } from "../platform-ports/path-port.ts";
import { importsIn } from "./piece-import-rules.ts";

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

const walkerRunnerSources = import.meta.glob(["./mechanisms/walker/runner/*.ts", "!**/*.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintRunnerSources = import.meta.glob(["./mechanisms/eslint/runner/*.ts", "!**/*.test.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const NAMED_CORE_FOLDERS = "core/(?:mechanism-port|values|platform-ports|rule-set-reader|exception-records)/";

const relativeTargetsWithin = (request: { readonly runnerFolder: string }) => {
  const runnerPath = createPathPort({ flavour: posixPathFlavour, workingDirectory: () => `/install/${request.runnerFolder}` });
  const relativeImport = z.object({
    specifier: z
      .string()
      .regex(/^\.\.?\//)
      .transform((specifier) => runnerPath.resolve({ path: specifier }))
      .pipe(z.string().regex(new RegExp(`^/install/(?:${request.runnerFolder}/|${NAMED_CORE_FOLDERS})`))),
    form: z.enum(["value", "type-only", "dynamic"]),
  });
  const packageOrComputedImport = z.object({
    specifier: z.string().regex(/^[^.]/),
    form: z.enum(["value", "type-only", "dynamic"]),
  });
  return z.record(
    z.string(),
    z
      .string()
      .transform((text) => importsIn({ text }))
      .pipe(z.array(z.union([relativeImport, packageOrComputedImport]))),
  );
};

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
    expect(runnerSourcesWithinCoreReach.safeParse(runnerSources).error).toBeUndefined();
  });

  it("finds every walker runner import resolving inside the walker runner or core's named folders", () => {
    expect(
      relativeTargetsWithin({ runnerFolder: "mechanisms/walker/runner" }).safeParse(walkerRunnerSources).error,
    ).toBeUndefined();
  });

  it("finds every ESLint runner import resolving inside the ESLint runner or core's named folders", () => {
    expect(
      relativeTargetsWithin({ runnerFolder: "mechanisms/eslint/runner" }).safeParse(eslintRunnerSources).error,
    ).toBeUndefined();
  });
});
