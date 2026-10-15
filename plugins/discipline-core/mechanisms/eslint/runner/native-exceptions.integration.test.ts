import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runCheck } from "../../../core/check/run-check.ts";
import { checkConformance } from "../../../core/conformance/conformance.ts";
import { type RunnerClause, runnerModuleSchema } from "../../../core/mechanism-port/runner-module-schema.ts";
import { createDefaultFileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { GitPort } from "../../../core/platform-ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createDefaultPathPort } from "../../../core/platform-ports/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import cd14Discipline from "../../../rules/CD-14/discipline.json" with { type: "json" };
import { runner as walkerRunner } from "../../walker/runner/runner.ts";
import { runner as eslintRunner } from "./runner.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../..`);

const CLAUSE = clauseAddressSchema.parse("CD-14#class-syntax");

const CLASS_SYNTAX = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/mechanisms/eslint/CD-14`,
  settings: { pluginNamespace: "rin-discipline", pluginModule: "cd14/cd14.eslint-plugin.ts", rule: "no-class-authoring" },
};

const WALKER_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/mechanisms/walker/CD-14`,
  settings: { module: "class-syntax.ts" },
};

const fileText = createDefaultFileTextPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const consumerRepo = (request: { readonly name: string }): AbsolutePath =>
  absolutePathSchema.parse(`${import.meta.dirname}/test-fixtures/${request.name}`);

const gitTracking = (request: { readonly tracked: readonly string[] }): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: z.array(repoPathSchema).parse(request.tracked) }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
});

const checkOf = (request: { readonly name: string; readonly tracked: readonly string[] }) =>
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
    await expect(checkOf({ name: "override-after", tracked: ["x.ts"] })).resolves.toMatchObject({
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
    await expect(checkOf({ name: "global-ignore", tracked: ["gen/g.ts", "src/clean.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "gen/g.ts", line: 1 })],
        unrecorded: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts", mechanism: "eslint" }],
        unmeasured: [],
      },
    });
  });

  it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
    await expect(checkOf({ name: "severity-zero", tracked: ["x.ts"] })).resolves.toMatchObject({
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
    await expect(checkOf({ name: "re-enabled-record", tracked: ["src/owned.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

describe("eslint-suppressions.json files and package.json lint scripts read by the ESLint runner, over a consumer repository", () => {
  it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
    await expect(
      checkOf({ name: "suppression-default", tracked: ["supp/a.ts", "eslint-suppressions.json"] }),
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
        tracked: ["supp/b.ts", "supp/clean.ts", "package.json", "custom/supp.json", "custom/supp2.json"],
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
      checkOf({ name: "suppression-nested", tracked: ["packages/a/src/n.ts", "packages/a/eslint-suppressions.json"] }),
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
    await expect(checkOf({ name: "command-line-options", tracked: ["src/plain.ts", "package.json"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [],
        unrecorded: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX,
            location: "package.json",
            script: "lint",
            option: "--rule rin-discipline/no-class-authoring: off",
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
            option: "--suppress-rule rin-discipline/no-class-authoring",
            mechanism: "eslint",
          },
        ],
      },
    });
  });
});

const INLINE_FORM_FILES = [
  "i/disable-file.ts",
  "i/disable-file-named.ts",
  "i/disable-line.ts",
  "i/disable-next-line.ts",
  "i/rule-config.ts",
  "i/other-rule.ts",
  "i/enable.ts",
  "i/global.ts",
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
            text: "/* eslint-disable rin-discipline/no-class-authoring */",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-line.ts",
            line: 2,
            text: "// eslint-disable-line rin-discipline/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX,
            file: "i/disable-next-line.ts",
            line: 1,
            text: "// eslint-disable-next-line rin-discipline/no-class-authoring",
            mechanism: "eslint",
          },
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX,
            file: "i/rule-config.ts",
            line: 1,
            text: '/* eslint rin-discipline/no-class-authoring: "off" */',
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
            snippet: "export class Kept {} // eslint-disable-line rin-discipline/no-class-authoring",
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
    await expect(checkOf({ name: "route-brackets", tracked: ["route/[id].ts", "route/i.ts"] })).resolves.toMatchObject({
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
    await expect(checkOf({ name: "projection-missing", tracked: ["x.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unmeasured: [{ kind: "mechanism-not-run", mechanism: "eslint", projection: "missing" }] },
    });
  });

  it("lists the projection out-of-date when it was hand-edited", async () => {
    await expect(checkOf({ name: "projection-hand-edited", tracked: ["x.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: {
        findings: [classFinding({ file: "x.ts", line: 1 })],
        unmeasured: [],
        projectionProblems: [{ mechanism: "eslint", state: "out-of-date" }],
      },
    });
  });

  it("lists mechanism-not-run not-included when the team config does not import the projection", async () => {
    await expect(checkOf({ name: "projection-not-imported", tracked: ["x.ts"] })).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });

  it("lists mechanism-not-run not-included when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
    await expect(
      checkOf({ name: "fragment-not-projection", tracked: ["src/owned.ts", "src/clean.ts"] }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { findings: [], unrecorded: [], unmeasured: [NOT_RUN_NOT_INCLUDED] },
    });
  });
});

const SHARED_CASE_FILES = z
  .array(repoPathSchema)
  .parse([
    "src/decl.ts",
    "src/expr.ts",
    "src/default.ts",
    "src/abstract.ts",
    "src/nested.ts",
    "src/space.ts",
    "src/anon.ts",
  ]);

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

describe("FR-3 over real files: the ESLint runner on real ESLint 10 and the walker runner on real TypeScript", () => {
  it("give the same whole anchors for every flagged CD-14 shared case", async () => {
    const eslintRun = await eslintRunner.run({ ...SHARED_CASES_RUN, records: [], clauses: [ESLINT_CLAUSE] });
    const walkerRun = await walkerRunner.run({ ...SHARED_CASES_RUN, clauses: [WALKER_CLAUSE] });
    expect({ eslint: eslintRun, walker: walkerRun }).toEqual({
      eslint: { outcome: "ok", value: { hits: EXPECTED_SHARED_HITS, nativeExceptions: [], projection: "current" } },
      walker: { outcome: "ok", value: EXPECTED_SHARED_HITS },
    });
  });
});

const sourceCaseSchema = z.object({
  name: z.string(),
  fileName: repoPathSchema,
  source: z.string(),
  expectedLines: z.array(z.number()),
});

const CLASS_SYNTAX_CASES = z
  .object({
    clauses: z.tuple([
      z.object({
        id: z.literal("class-syntax"),
        cases: z.object({ flag: z.array(sourceCaseSchema), allow: z.array(sourceCaseSchema) }),
      }),
      z.object({ id: z.literal("library-construction") }),
    ]),
  })
  .parse(cd14Discipline).clauses[0].cases;

const coreLoadedEslintRunner = () =>
  modules
    .load({ path: `${INSTALL_ROOT}/mechanisms/eslint/runner/runner.ts` })
    .then(
      (loaded) =>
        z.object({ outcome: z.literal("ok"), value: z.object({ runner: runnerModuleSchema }) }).parse(loaded).value
          .runner,
    );

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
