import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPathPort, posixPathFlavour } from "../platform-ports/path-port.ts";
import { importsIn, type ModuleImport } from "./piece-import-rules.ts";

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: { readonly base: string; readonly query: "?raw"; readonly import: "default"; readonly eager: true },
    ) => Readonly<Record<string, string>>;
  }
}

const sourcesOutsideMechanisms = import.meta.glob(
  [
    "./**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!**/node_modules/**",
    "!**/*.test.*",
    "!**/test-fixtures/**",
    "!./mechanisms/**",
    "!./vitest.config.ts",
    "!./core/platform-ports/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./tests/probe-rule-set/mechanisms/walker/**",
    "!./tests/probe-rule-set/mechanisms/eslint/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const runnerSources = import.meta.glob(
  [
    "./mechanisms/*/runner/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!**/*.test.*",
    "!**/test-fixtures/**",
    "!./mechanisms/walker/runner/typescript-parse.ts",
    "!./mechanisms/eslint/runner/eslint-instance.ts",
    "!./mechanisms/eslint/runner/inline-config-parser.ts",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const unlistedMechanismSources = import.meta.glob(
  [
    "./mechanisms/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!**/*.test.*",
    "!**/test-fixtures/**",
    "!./mechanisms/*/runner/**",
    "!./mechanisms/walker/*/*",
    "!./mechanisms/walker/*/*/**",
    "!./mechanisms/eslint/*/*",
    "!./mechanisms/eslint/*/*/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const platformPortSources = import.meta.glob(
  ["./core/platform-ports/*-port.{ts,mts,cts,tsx,js,mjs,cjs}", "!**/*.test.*", "!./core/platform-ports/module-loader-port.ts"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const moduleLoaderPortSources = import.meta.glob(["./core/platform-ports/module-loader-port.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const coreSourcesOffFolderDepth = import.meta.glob(
  ["./core/*.{ts,mts,cts,tsx,js,mjs,cjs}", "./core/*/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}", "!**/*.test.*", "!**/test-fixtures/**"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const coreSources = import.meta.glob(["./core/**/*.{ts,mts,cts,tsx,js,mjs,cjs}", "!**/*.test.*", "!**/test-fixtures/**"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const typescriptWrapperSources = import.meta.glob(["./mechanisms/walker/runner/typescript-parse.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const eslintWrapperSources = import.meta.glob(["./mechanisms/eslint/runner/eslint-instance.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const pluginKitWrapperSources = import.meta.glob(["./mechanisms/eslint/runner/inline-config-parser.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const walkerPieceSources = import.meta.glob(
  [
    "./mechanisms/walker/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./tests/probe-rule-set/mechanisms/walker/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./mechanisms/walker/runner/**",
    "!**/*.test.*",
    "!**/test-fixtures/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const eslintPieceSources = import.meta.glob(
  [
    "./mechanisms/eslint/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./tests/probe-rule-set/mechanisms/eslint/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./mechanisms/eslint/runner/**",
    "!**/*.test.*",
    "!**/test-fixtures/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const vitestConfigSources = import.meta.glob(["./vitest.config.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const relativeImport = z.object({ specifier: z.string().regex(/^\.\.?\//), form: z.enum(["value", "type-only"]) });

const zodImport = z.object({ specifier: z.literal("zod"), form: z.enum(["value", "type-only"]) });

const nodeBuiltinImport = z.object({ specifier: z.string().regex(/^node:/), form: z.enum(["value", "type-only"]) });

const computedModuleLoad = z.object({ specifier: z.string().regex(/[^\w@/.:-]/), form: z.literal("dynamic") });

const packageImport = (packageName: string) =>
  z.object({ specifier: z.literal(packageName), form: z.enum(["value", "type-only"]) });

const packageTypeImport = (packageName: string) =>
  z.object({ specifier: z.literal(packageName), form: z.literal("type-only") });

const coreFolderPath = createPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/install/core/folder" });

const relativeImportUnderCore = z.object({
  specifier: z
    .string()
    .regex(/^\.\.?\//)
    .transform((specifier) => coreFolderPath.resolve({ path: specifier }))
    .pipe(z.string().regex(/^\/install\/core\//, "resolves outside core/")),
  form: z.enum(["value", "type-only", "dynamic"]),
});

const packageOrComputedImport = z.object({
  specifier: z.string().regex(/^[^.]/),
  form: z.enum(["value", "type-only", "dynamic"]),
});

const relativeTargetsUnderCore = z.record(
  z.string(),
  z
    .string()
    .transform((text) => importsIn({ text }))
    .pipe(z.array(z.union([relativeImportUnderCore, packageOrComputedImport]))),
);

const importsOnly = (allowed: readonly [z.ZodType<unknown, ModuleImport>, ...z.ZodType<unknown, ModuleImport>[]]) =>
  z.record(
    z.string(),
    z
      .string()
      .transform((text) => importsIn({ text }))
      .pipe(z.array(z.union(allowed))),
  );

describe("Vendor confinement over what this repository's own discipline-core source imports, read as build-time raw modules (CD-19, CD-20; CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads core's check dispatch among the files outside the mechanisms", () => {
    expect(sourcesOutsideMechanisms).toEqual(expect.objectContaining({ "./core/check/run-check.ts": expect.any(String) }));
  });

  it("reads the ESLint runner factory among the runner files", () => {
    expect(runnerSources).toEqual(expect.objectContaining({ "./mechanisms/eslint/runner/create-eslint-runner.ts": expect.any(String) }));
  });

  it("leaves the TypeScript wrapping file out of the runner files", () => {
    expect(runnerSources).not.toHaveProperty(["./mechanisms/walker/runner/typescript-parse.ts"]);
  });

  it("finds no mechanism source outside a runner folder or a walker or ESLint piece folder", () => {
    expect(unlistedMechanismSources).toEqual({});
  });

  it("reads the file-text port among the platform ports", () => {
    expect(platformPortSources).toEqual(expect.objectContaining({ "./core/platform-ports/file-text-port.ts": expect.any(String) }));
  });

  it("leaves the module-loader port out of the platform ports", () => {
    expect(platformPortSources).not.toHaveProperty(["./core/platform-ports/module-loader-port.ts"]);
  });

  it("reads core's check dispatch among the core files", () => {
    expect(coreSources).toEqual(expect.objectContaining({ "./core/check/run-check.ts": expect.any(String) }));
  });

  it("finds every core source file directly in a folder of core", () => {
    expect(coreSourcesOffFolderDepth).toEqual({});
  });

  it("finds every relative import in a core file resolving under core/", () => {
    expect(relativeTargetsUnderCore.safeParse(coreSources).error).toBeUndefined();
  });

  it("reads the CD-14 walker piece and the probe's walker piece among the walker pieces", () => {
    expect(walkerPieceSources).toEqual(
      expect.objectContaining({
        "./mechanisms/walker/CD-14/class-syntax.ts": expect.any(String),
        "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts": expect.any(String),
      }),
    );
  });

  it("reads the CD-14 ESLint plugin among the ESLint pieces", () => {
    expect(eslintPieceSources).toEqual(expect.objectContaining({ "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts": expect.any(String) }));
  });

  it("finds every file outside the mechanisms, platform ports and probe pieces importing only relative paths and zod", () => {
    expect(
      importsOnly([relativeImport, zodImport]).safeParse(sourcesOutsideMechanisms).error,
    ).toBeUndefined();
  });

  it("finds every runner file outside the wrapping files importing only relative paths and zod", () => {
    expect(importsOnly([relativeImport, zodImport]).safeParse(runnerSources).error).toBeUndefined();
  });

  it("finds the platform ports other than the module loader importing only relative paths, zod and node builtins", () => {
    expect(
      importsOnly([relativeImport, zodImport, nodeBuiltinImport]).safeParse(platformPortSources).error,
    ).toBeUndefined();
  });

  it("finds the module-loader port importing only relative paths, zod, node builtins and computed module loads", () => {
    expect(
      importsOnly([relativeImport, zodImport, nodeBuiltinImport, computedModuleLoad]).safeParse(
        moduleLoaderPortSources,
      ).error,
    ).toBeUndefined();
  });

  it("finds typescript-parse.ts the only file importing typescript by value", () => {
    expect(
      importsOnly([relativeImport, zodImport, packageImport("typescript")]).safeParse(
        typescriptWrapperSources,
      ).error,
    ).toBeUndefined();
  });

  it("finds eslint-instance.ts the only file importing eslint and @typescript-eslint/parser by value", () => {
    expect(
      importsOnly([relativeImport, zodImport, packageImport("eslint"), packageImport("@typescript-eslint/parser")]).safeParse(
        eslintWrapperSources,
      ).error,
    ).toBeUndefined();
  });

  it("finds inline-config-parser.ts the only file importing @eslint/plugin-kit by value", () => {
    expect(
      importsOnly([relativeImport, zodImport, packageImport("@eslint/plugin-kit")]).safeParse(
        pluginKitWrapperSources,
      ).error,
    ).toBeUndefined();
  });

  it("finds walker pieces taking only types from typescript", () => {
    expect(
      importsOnly([relativeImport, zodImport, packageTypeImport("typescript")]).safeParse(
        walkerPieceSources,
      ).error,
    ).toBeUndefined();
  });

  it("finds ESLint pieces taking only types from eslint", () => {
    expect(
      importsOnly([relativeImport, zodImport, packageTypeImport("eslint")]).safeParse(eslintPieceSources)
        .error,
    ).toBeUndefined();
  });

  it("finds the Vitest configuration importing only vitest/config", () => {
    expect(
      importsOnly([packageImport("vitest/config")]).safeParse(vitestConfigSources).error,
    ).toBeUndefined();
  });
});
