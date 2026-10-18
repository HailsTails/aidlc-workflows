import { describe, expect, it } from "vitest";
import { createPathPort } from "../platform-ports/path-port.ts";
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
    "!./node_modules/**",
    "!./*.test.*",
    "!./core/**/*.test.*",
    "!./rules/**/*.test.*",
    "!./tests/**/*.test.*",
    "!./scripts/**/*.test.*",
    "!./tests/test-fixtures/**",
    "!./tests/required-entry.ts",
    "!./mechanisms/**",
    "!./vitest.config.ts",
    "!./scripts/install-proof-ports.ts",
    "!./core/platform-ports/*-port.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./tests/probe-rule-set/mechanisms/walker/**",
    "!./tests/probe-rule-set/mechanisms/eslint/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const runnerSources = import.meta.glob(
  [
    "./mechanisms/*/runner/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./mechanisms/*/runner/**/*.test.*",
    "!./mechanisms/*/runner/test-fixtures/**",
    "!./mechanisms/walker/runner/typescript-parse.ts",
    "!./mechanisms/eslint/runner/eslint-instance.ts",
    "!./mechanisms/eslint/runner/inline-config-parser.ts",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const unlistedMechanismSources = import.meta.glob(
  [
    "./mechanisms/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./mechanisms/**/*.test.*",
    "!./mechanisms/**/test-fixtures/**",
    "!./mechanisms/*/runner/**",
    "!./mechanisms/walker/*/*",
    "!./mechanisms/walker/*/*/**",
    "!./mechanisms/eslint/*/*",
    "!./mechanisms/eslint/*/*/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const platformPortSources = import.meta.glob(
  ["./core/platform-ports/*-port.{ts,mts,cts,tsx,js,mjs,cjs}", "!./core/platform-ports/*.test.*", "!./core/platform-ports/module-loader-port.ts"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const moduleLoaderPortSources = import.meta.glob(["./core/platform-ports/module-loader-port.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const installProofPortSources = import.meta.glob(["./scripts/install-proof-ports.ts"], {
  base: "../../",
  query: "?raw",
  import: "default",
  eager: true,
});

const coreSources = import.meta.glob(["./core/**/*.{ts,mts,cts,tsx,js,mjs,cjs}", "!./core/**/*.test.*", "!./core/**/test-fixtures/**"], {
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
    "!./mechanisms/walker/**/*.test.*",
    "!./tests/probe-rule-set/mechanisms/walker/**/*.test.*",
    "!./mechanisms/walker/**/test-fixtures/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const eslintPieceSources = import.meta.glob(
  [
    "./mechanisms/eslint/*/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "./tests/probe-rule-set/mechanisms/eslint/**/*.{ts,mts,cts,tsx,js,mjs,cjs}",
    "!./mechanisms/eslint/runner/**",
    "!./mechanisms/eslint/**/*.test.*",
    "!./tests/probe-rule-set/mechanisms/eslint/**/*.test.*",
    "!./mechanisms/eslint/**/test-fixtures/**",
  ],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

const testSources = import.meta.glob(
  ["./**/*.test.{ts,mts,cts,tsx}", "./tests/required-entry.ts", "!./node_modules/**", "!./**/test-fixtures/**"],
  { base: "../../", query: "?raw", import: "default", eager: true },
);

type ImportAllowance = (request: { readonly moduleImport: ModuleImport }) => boolean;

const RELATIVE_SPECIFIER = /^\.\.?\//;

const isStaticForm = (request: { readonly moduleImport: ModuleImport }): boolean =>
  request.moduleImport.form === "value" || request.moduleImport.form === "type-only";

const relativeImport: ImportAllowance = ({ moduleImport }) =>
  RELATIVE_SPECIFIER.test(moduleImport.specifier) && isStaticForm({ moduleImport });

const relativeImportOfAnyForm: ImportAllowance = ({ moduleImport }) => RELATIVE_SPECIFIER.test(moduleImport.specifier);

const nodeBuiltinImport: ImportAllowance = ({ moduleImport }) =>
  /^node:/.test(moduleImport.specifier) && isStaticForm({ moduleImport });

const computedModuleLoad: ImportAllowance = ({ moduleImport }) =>
  /[^\w@/.:-]/.test(moduleImport.specifier) && moduleImport.form === "dynamic";

const packageImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && isStaticForm({ moduleImport });

const packageTypeImport =
  (request: { readonly packageName: string }): ImportAllowance =>
  ({ moduleImport }) =>
    moduleImport.specifier === request.packageName && moduleImport.form === "type-only";

const zodImport = packageImport({ packageName: "zod" });

const vitestImport = packageImport({ packageName: "vitest" });

const coreFolderPath = createPathPort({ flavour: "posix", workingDirectory: () => "/install/core/folder" });

const relativeImportUnderCore: ImportAllowance = ({ moduleImport }) => {
  if (!RELATIVE_SPECIFIER.test(moduleImport.specifier)) {
    return false;
  }
  const location = coreFolderPath.relative({ from: "/install", to: moduleImport.specifier });
  return location.relation === "within-root" && location.path.startsWith("core/");
};

const packageOrComputedImport: ImportAllowance = ({ moduleImport }) => /^[^.]/.test(moduleImport.specifier);

const importsOutside = (request: {
  readonly sources: Readonly<Record<string, string>>;
  readonly allowed: readonly ImportAllowance[];
}): readonly (ModuleImport & { readonly file: string })[] =>
  Object.entries(request.sources).flatMap(([file, text]) =>
    importsIn({ text })
      .filter((moduleImport) => !request.allowed.some((allows) => allows({ moduleImport })))
      .map((moduleImport) => ({ file, ...moduleImport })),
  );

describe("Vendor confinement over what this repository's own discipline-core source imports, read as build-time raw modules (CD-19, CD-20; CD-47: that source is the assertion's subject and no fake can stand in for it; nothing is spawned or written)", () => {
  it("reads a known file through every scanned set, so no set is silently empty", () => {
    expect({
      sourcesOutsideMechanisms,
      runnerSources,
      platformPortSources,
      coreSources,
      installProofPortSources,
      walkerPieceSources,
      eslintPieceSources,
      testSources,
    }).toEqual({
      sourcesOutsideMechanisms: expect.objectContaining({
        "./core/check/run-check.ts": expect.any(String),
        "./scripts/install-proof.ts": expect.any(String),
        "./scripts/run-install-proof.ts": expect.any(String),
      }),
      runnerSources: expect.objectContaining({ "./mechanisms/eslint/runner/create-eslint-runner.ts": expect.any(String) }),
      platformPortSources: expect.objectContaining({ "./core/platform-ports/file-text-port.ts": expect.any(String) }),
      coreSources: expect.objectContaining({ "./core/check/run-check.ts": expect.any(String) }),
      installProofPortSources: { "./scripts/install-proof-ports.ts": expect.any(String) },
      walkerPieceSources: expect.objectContaining({
        "./mechanisms/walker/CD-14/class-syntax.ts": expect.any(String),
        "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.ts": expect.any(String),
      }),
      eslintPieceSources: expect.objectContaining({ "./mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts": expect.any(String) }),
      testSources: expect.objectContaining({
        "./core/check/run-check.test.ts": expect.any(String),
        "./tests/probe-rule-set/mechanisms/walker/PD-1/no-tmp-files.test.ts": expect.any(String),
        "./tests/required-entry.ts": expect.any(String),
      }),
    });
  });

  it("finds no mechanism source outside a runner folder or a walker or ESLint piece folder", () => {
    expect(unlistedMechanismSources).toEqual({});
  });

  it("finds every relative import in a core file resolving under core/", () => {
    expect(
      importsOutside({ sources: coreSources, allowed: [relativeImportUnderCore, packageOrComputedImport] }),
    ).toEqual([]);
  });

  it("finds every file outside the mechanisms, platform ports, probe pieces and tests importing only relative paths and zod", () => {
    expect(importsOutside({ sources: sourcesOutsideMechanisms, allowed: [relativeImport, zodImport] })).toEqual([]);
  });

  it("finds every runner file outside the wrapping files importing only relative paths and zod", () => {
    expect(importsOutside({ sources: runnerSources, allowed: [relativeImport, zodImport] })).toEqual([]);
  });

  it("finds the platform ports other than the module loader importing only relative paths, zod and node builtins", () => {
    expect(
      importsOutside({ sources: platformPortSources, allowed: [relativeImport, zodImport, nodeBuiltinImport] }),
    ).toEqual([]);
  });

  it("finds the module-loader port importing only relative paths, zod, node builtins and computed module loads", () => {
    expect(
      importsOutside({
        sources: moduleLoaderPortSources,
        allowed: [relativeImport, zodImport, nodeBuiltinImport, computedModuleLoad],
      }),
    ).toEqual([]);
  });

  it("finds scripts/install-proof-ports.ts, the install proof's wrapping ports, importing only relative paths and node builtins", () => {
    expect(importsOutside({ sources: installProofPortSources, allowed: [relativeImport, nodeBuiltinImport] })).toEqual([]);
  });

  it("finds typescript-parse.ts the only file importing typescript by value", () => {
    expect(
      importsOutside({
        sources: typescriptWrapperSources,
        allowed: [relativeImport, zodImport, packageImport({ packageName: "typescript" })],
      }),
    ).toEqual([]);
  });

  it("finds eslint-instance.ts the only file importing eslint and @typescript-eslint/parser by value", () => {
    expect(
      importsOutside({
        sources: eslintWrapperSources,
        allowed: [
          relativeImport,
          zodImport,
          packageImport({ packageName: "eslint" }),
          packageImport({ packageName: "@typescript-eslint/parser" }),
        ],
      }),
    ).toEqual([]);
  });

  it("finds inline-config-parser.ts the only file importing @eslint/plugin-kit by value", () => {
    expect(
      importsOutside({
        sources: pluginKitWrapperSources,
        allowed: [relativeImport, zodImport, packageImport({ packageName: "@eslint/plugin-kit" })],
      }),
    ).toEqual([]);
  });

  it("finds walker pieces taking only types from typescript", () => {
    expect(
      importsOutside({
        sources: walkerPieceSources,
        allowed: [relativeImport, zodImport, packageTypeImport({ packageName: "typescript" })],
      }),
    ).toEqual([]);
  });

  it("finds ESLint pieces taking only types from eslint", () => {
    expect(
      importsOutside({
        sources: eslintPieceSources,
        allowed: [relativeImport, zodImport, packageTypeImport({ packageName: "eslint" })],
      }),
    ).toEqual([]);
  });

  it("finds every test file and the test-support module importing only relative paths and vitest, type-only imports included, so zod, eslint and typescript reach a test only through their owners", () => {
    expect(importsOutside({ sources: testSources, allowed: [relativeImportOfAnyForm, vitestImport] })).toEqual([]);
  });
});
