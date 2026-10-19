import { assert, describe, expect, it, vi } from "vitest";
import { runCheck } from "../../../core/check/run-check.ts";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import {
  type LoadedRunner,
  type RunnerClause,
  runnerModuleSchema,
} from "../../../core/mechanism-port/runner-module-schema.ts";
import { createDefaultFileTextPort, type FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../../../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort, createPathPort } from "../../../core/platform-ports/path-port.ts";
import { type ClauseDefinition, readDisciplineFile } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { disciplineIdSchema } from "../../../core/values/identifiers.ts";
import { type RepoPath, repoPathSchema } from "../../../core/values/repo-path.ts";
import cd14Discipline from "../../../rules/CD-14/discipline.json" with { type: "json" };
import { runner as walkerRunner } from "../../audit/runner/runner.ts";
import { runner as eslintRunner } from "./runner.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_SYNTAX = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/mechanisms/eslint/CD-14`,
  settings: { pluginNamespace: "discipline", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const WALKER_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/mechanisms/audit/CD-14`,
  settings: { module: "class-syntax.ts" },
};

const fileText = createDefaultFileTextPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const consumerRepo = (request: { readonly name: string }): AbsolutePath =>
  absolutePathSchema.parse(`${import.meta.dirname}/test-fixtures/${request.name}`);

const gitTracking = (request: { readonly tracked: readonly RepoPath[] }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: request.tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
});

const checkOf = (request: { readonly name: string; readonly tracked: readonly RepoPath[] }) =>
  runCheck({
    repoRoot: consumerRepo({ name: request.name }),
    installRoot: INSTALL_ROOT,
    baseRevision: undefined,
    fileText,
    modules,
    path,
    git: gitTracking({ tracked: request.tracked }),
  });

const classFinding = (request: { readonly file: string; readonly line: number }) => ({
  clause: CLASS_SYNTAX,
  file: request.file,
  anchor: { line: request.line, column: 7 },
  snippet: "export class Kept {}",
  mechanism: "eslint",
});

const NOT_RUN_NOT_INCLUDED = { kind: "mechanism-not-run", mechanism: "eslint", projection: "not-included" };

describe("real ESLint 10 config resolution behind the ESLint runner's query instance, over a consumer repository", () => {
  it("reports an unrecorded override block placed after the projection as a config-override", async () => {
    await expect(checkOf({ name: "override-after", tracked: [repoPathSchema.parse("x.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
    await expect(checkOf({ name: "global-ignore", tracked: [repoPathSchema.parse("gen/g.ts"), repoPathSchema.parse("src/clean.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "gen/g.ts", line: 1 })],
        unrecorded: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts", mechanism: "eslint" }],
        unmeasured: [],
      },
    });
  });

  it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
    await expect(checkOf({ name: "severity-zero", tracked: [repoPathSchema.parse("x.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unrecorded: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts", mechanism: "eslint" }],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });

  it("lists mechanism-not-run not-included when a later team block sets a recorded file back to error", async () => {
    await expect(checkOf({ name: "re-enabled-record", tracked: [repoPathSchema.parse("src/owned.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

describe("eslint-suppressions.json files and package.json lint scripts read by the ESLint runner, over a consumer repository", () => {
  it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
    await expect(
      checkOf({ name: "suppression-default", tracked: [repoPathSchema.parse("supp/a.ts"), repoPathSchema.parse("eslint-suppressions.json")] }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/a.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/a.ts",
            location: "eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
    await expect(
      checkOf({
        name: "suppression-scripted",
        tracked: [
          repoPathSchema.parse("supp/b.ts"),
          repoPathSchema.parse("supp/clean.ts"),
          repoPathSchema.parse("package.json"),
          repoPathSchema.parse("custom/supp.json"),
          repoPathSchema.parse("custom/supp2.json"),
        ],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "supp/b.ts", line: 1 })],
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/b.ts",
            location: "custom/supp.json",
            mechanism: "eslint",
          },
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "supp/clean.ts",
            location: "custom/supp2.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
    await expect(
      checkOf({
        name: "suppression-nested",
        tracked: [repoPathSchema.parse("packages/a/src/n.ts"), repoPathSchema.parse("packages/a/eslint-suppressions.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX,
            file: "packages/a/src/n.ts",
            location: "packages/a/eslint-suppressions.json",
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("reports each weakening command-line option in a lint script and not a rule id that merely extends the selected one", async () => {
    await expect(
      checkOf({
        name: "command-line-options",
        tracked: [repoPathSchema.parse("src/plain.ts"), repoPathSchema.parse("package.json")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        unrecorded: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--rule discipline/no-class-authoring: off",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--ignore-pattern dormant/**",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "-c alt.config.mjs",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-all",
            mechanism: "eslint",
          },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint:suppress",
            option: "--suppress-rule discipline/no-class-authoring",
            mechanism: "eslint",
          },
        ],
      },
    });
  });
});

const INLINE_FORM_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("i/disable-file.ts"),
  repoPathSchema.parse("i/disable-file-named.ts"),
  repoPathSchema.parse("i/disable-line.ts"),
  repoPathSchema.parse("i/disable-next-line.ts"),
  repoPathSchema.parse("i/rule-config.ts"),
  repoPathSchema.parse("i/other-rule.ts"),
  repoPathSchema.parse("i/enable.ts"),
  repoPathSchema.parse("i/global.ts"),
];

describe("inline configuration comments read by the ESLint runner's governance rule on real ESLint 10, over a consumer repository", () => {
  it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
    await expect(checkOf({ name: "inline-forms", tracked: INLINE_FORM_FILES })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        unrecorded: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file.ts",
            line: 1,
            text: "/* eslint-disable */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-file-named.ts",
            line: 1,
            text: "/* eslint-disable discipline/no-class-authoring */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            line: 2,
            text: "// eslint-disable-line discipline/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-next-line.ts",
            line: 1,
            text: "// eslint-disable-next-line discipline/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX,
            file: "i/rule-config.ts",
            line: 1,
            text: '/* eslint discipline/no-class-authoring: "off" */',
            mechanism: "eslint",
          },
        ],
      },
    });
  });

  it("still finds the class in every file whatever its inline comment says", async () => {
    await expect(checkOf({ name: "inline-forms", tracked: INLINE_FORM_FILES })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [
          classFinding({ file: "i/disable-file.ts", line: 2 }),
          classFinding({ file: "i/disable-file-named.ts", line: 2 }),
          {
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            anchor: { line: 2, column: 7 },
            snippet: "export class Kept {} // eslint-disable-line discipline/no-class-authoring",
            mechanism: "eslint",
          },
          classFinding({ file: "i/disable-next-line.ts", line: 2 }),
          classFinding({ file: "i/rule-config.ts", line: 2 }),
          classFinding({ file: "i/other-rule.ts", line: 2 }),
          classFinding({ file: "i/enable.ts", line: 2 }),
          classFinding({ file: "i/global.ts", line: 2 }),
        ],
      },
    });
  });
});

describe("real ESLint 10 glob matching of the generated projection's record blocks, over a consumer repository", () => {
  it("exempts route/[id].ts by its authorised location and still finds the class in route/i.ts", async () => {
    await expect(
      checkOf({ name: "route-brackets", tracked: [repoPathSchema.parse("route/[id].ts"), repoPathSchema.parse("route/i.ts")] }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "route/i.ts", line: 1 })],
        exempted: [
          {
            finding: classFinding({ file: "route/[id].ts", line: 1 }),
            by: [{ kind: "authorised-location", file: "route/[id].ts" }],
          },
        ],
        unrecorded: [],
        unmeasured: [],
        projectionProblems: [],
      },
    });
  });
});

describe("the ESLint runner's projection states under real ESLint 10, over a consumer repository", () => {
  it("lists mechanism-not-run missing when the projection was never generated", async () => {
    await expect(checkOf({ name: "projection-missing", tracked: [repoPathSchema.parse("x.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unmeasured: [{ kind: "mechanism-not-run", mechanism: "eslint", projection: "missing" }] },
    });
  });

  it("lists the projection out-of-date when it was hand-edited", async () => {
    await expect(checkOf({ name: "projection-hand-edited", tracked: [repoPathSchema.parse("x.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unmeasured: [],
        projectionProblems: [{ mechanism: "eslint", state: "out-of-date" }],
      },
    });
  });

  it("lists mechanism-not-run not-included when the team config does not import the projection", async () => {
    await expect(checkOf({ name: "projection-not-imported", tracked: [repoPathSchema.parse("x.ts")] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });

  it("lists mechanism-not-run not-included when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
    await expect(
      checkOf({
        name: "fragment-not-projection",
        tracked: [repoPathSchema.parse("src/owned.ts"), repoPathSchema.parse("src/clean.ts")],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

const SHARED_CASE_FILES: readonly RepoPath[] = [
  repoPathSchema.parse("src/decl.ts"),
  repoPathSchema.parse("src/expr.ts"),
  repoPathSchema.parse("src/default.ts"),
  repoPathSchema.parse("src/abstract.ts"),
  repoPathSchema.parse("src/nested.ts"),
  repoPathSchema.parse("src/space.ts"),
  repoPathSchema.parse("src/anon.ts"),
];

const SHARED_CASES_RUN = {
  repoRoot: consumerRepo({ name: "fr3-anchors" }),
  installRoot: INSTALL_ROOT,
  files: SHARED_CASE_FILES,
  trackedPaths: SHARED_CASE_FILES,
};

const EXPECTED_SHARED_HITS = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts", anchor: { line: 1, column: 7 }, snippet: "export class Alpha {}" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts", anchor: { line: 1, column: 20 }, snippet: "export const Beta = class {};" },
  { clause: CLASS_SYNTAX, file: "src/default.ts", anchor: { line: 2, column: 0 }, snippet: "class {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/abstract.ts",
    anchor: { line: 1, column: 16 },
    snippet: "export abstract class Gamma {}",
  },
  { clause: CLASS_SYNTAX, file: "src/nested.ts", anchor: { line: 2, column: 2 }, snippet: "class Delta {}" },
  { clause: CLASS_SYNTAX, file: "src/space.ts", anchor: { line: 2, column: 9 }, snippet: "export class Epsilon {}" },
  {
    clause: CLASS_SYNTAX,
    file: "src/anon.ts",
    anchor: { line: 1, column: 25 },
    snippet: "export const zeta = new (class {})();",
  },
];

describe("FR-3 over real files: the ESLint runner on real ESLint 10 and the audit runner on real TypeScript", () => {
  it("give the same whole anchors for every flagged CD-14 shared case", async () => {
    const eslintRun = await eslintRunner.run({ ...SHARED_CASES_RUN, records: [], clauses: [ESLINT_CLAUSE] });
    const walkerRun = await walkerRunner.run({ ...SHARED_CASES_RUN, clauses: [WALKER_CLAUSE] });
    expect({ eslint: eslintRun, audit: walkerRun }).toEqual({
      eslint: { outcome: "ok", value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], projection: "current" } },
      audit: { outcome: "ok", value: EXPECTED_SHARED_HITS },
    });
  });
});

type MechanicalCases = Extract<ClauseDefinition, { readonly kind: "mechanical" }>["cases"];

const classSyntaxCases = (): MechanicalCases => {
  const loaded = readDisciplineFile({
    fileText: {
      read: () => ({ outcome: "ok", value: JSON.stringify(cd14Discipline) }),
      exists: () => "present",
      write: vi.fn<FileTextPort["write"]>(),
    },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: absolutePathSchema.parse("/install"),
    discipline: disciplineIdSchema.parse("CD-14"),
  });
  assert(loaded.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  const [classSyntax, libraryConstruction, ...surplus] = loaded.value.clauses;
  assert(classSyntax?.id === "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert(classSyntax.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  assert(
    libraryConstruction?.id === "library-construction",
    "CD-14 declares the library-construction judgement clause second",
  );
  assert(surplus.length === 0, "CD-14 declares exactly two clauses");
  return classSyntax.cases;
};

const CLASS_SYNTAX_CASES = classSyntaxCases();

const exportedRunnerOf = (request: { readonly namespace: unknown }): unknown => {
  assert(
    typeof request.namespace === "object" && request.namespace !== null && "runner" in request.namespace,
    "the runner module exports runner",
  );
  return request.namespace.runner;
};

const coreLoadedEslintRunner = async (): Promise<LoadedRunner> => {
  const loaded = await modules.load({ path: `${INSTALL_ROOT}/mechanisms/eslint/runner/runner.ts` });
  assert(loaded.outcome === "ok", "core loads the ESLint runner module");
  return runnerModuleSchema.parse(exportedRunnerOf({ namespace: loaded.value }));
};

describe("checkConformance over the ESLint runner as core loads it, on real ESLint 10", () => {
  it("has no failures for CD-14#class-syntax over every CD-14 shared case", async () => {
    await expect(
      checkConformance({
        clause: ESLINT_CLAUSE,
        cases: [...CLASS_SYNTAX_CASES.flag, ...CLASS_SYNTAX_CASES.allow],
        runner: await coreLoadedEslintRunner(),
      }),
    ).resolves.toEqual({ outcome: "ok", value: [] });
  });
});
