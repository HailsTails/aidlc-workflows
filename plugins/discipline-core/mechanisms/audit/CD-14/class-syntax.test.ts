import { assert, describe, expect, it, vi } from "vitest";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createPathPort, type PathPort } from "../../../core/platform-ports/path-port.ts";
import { type ClauseDefinition, readDisciplineFile } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { disciplineIdSchema } from "../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import discipline from "../../../rules/CD-14/discipline.json" with { type: "json" };
import { requiredEntry } from "../../../tests/required-entry.ts";
import { createWalkerRunner } from "../runner/create-walker-runner.ts";
import { createDefaultParsePort } from "../runner/typescript-parse.ts";
import { check } from "./class-syntax.ts";

const CLASS_ON_LINE_THREE = "const a = 1;\n\n  class Alpha {}\n";
const ADDRESS = clauseAddressSchema.parse("CD-14#class-syntax");

type MechanicalCases = Extract<ClauseDefinition, { readonly kind: "mechanical" }>["cases"];

const classSyntaxCases = (): MechanicalCases => {
  const loaded = readDisciplineFile({
    fileText: {
      read: () => ({ outcome: "ok", value: JSON.stringify(discipline) }),
      exists: () => "present",
      write: vi.fn<FileTextPort["write"]>(),
    },
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/install" }),
    ruleSetRoot: absolutePathSchema.parse("/install"),
    discipline: disciplineIdSchema.parse("CD-14"),
  });
  assert(loaded.outcome === "ok", "CD-14 discipline.json reads through the rule-set reader");
  const [classSyntax, libraryConstruction, staticOnlyClass, ...surplus] = loaded.value.clauses;
  assert(classSyntax?.id === "class-syntax", "CD-14 declares class-syntax as its first clause");
  assert(classSyntax.kind === "mechanical", "CD-14 declares class-syntax as a mechanical clause");
  assert(
    libraryConstruction?.id === "library-construction",
    "CD-14 declares the library-construction judgement clause second",
  );
  assert(staticOnlyClass?.id === "static-only-class", "CD-14 declares the static-only-class clause third");
  assert(surplus.length === 0, "CD-14 declares exactly three clauses");
  return classSyntax.cases;
};

const sharedCases = classSyntaxCases();

const CLAUSE: RunnerClause = {
  address: ADDRESS,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: "/install/mechanisms/audit/CD-14",
  settings: { module: "class-syntax.ts" },
};

const sourceOnLineThree: FileTextPort = {
  read: () => ({ outcome: "ok", value: CLASS_ON_LINE_THREE }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loadingThisPiece: ModuleLoaderPort = {
  load: () => Promise.resolve({ outcome: "ok", value: { check } }),
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","src/alpha.ts"]': "/repo/src/alpha.ts",
  '["/install/mechanisms/audit/CD-14","class-syntax.ts"]':
    "/install/mechanisms/audit/CD-14/class-syntax.ts",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const walkerRunner = createWalkerRunner({
  fileText: sourceOnLineThree,
  modules: loadingThisPiece,
  path: TABLE_PATH,
  parse: createDefaultParsePort({}),
});

describe("CD-14 class-syntax audit check over TypeScript's own parse", () => {
  it.each([
    ...sharedCases.flag,
    ...sharedCases.allow,
  ])("flags exactly the expected lines of the shared case $name", async (sharedCase) => {
    expect(await walkerRunner.conform({ clause: CLAUSE, cases: [sharedCase] })).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });

  it.each([
    { name: "a nested node_modules folder", fileName: "src/node_modules/lib/a.ts" },
    { name: "a dist folder", fileName: "dist/a.ts" },
    { name: "a root vendor folder", fileName: "vendor/a.ts" },
  ])("flags nothing in $name, a generated folder the audit skips", async ({ name, fileName }) => {
    expect(
      await walkerRunner.conform({
        clause: CLAUSE,
        cases: [{ name, fileName: repoPathSchema.parse(fileName), source: "export class Generated {}\n", expectedLines: [] }],
      }),
    ).toEqual({ outcome: "ok", value: [{ caseName: name, flaggedLines: [] }] });
  });

  it("anchors a class on line 3 at its class keyword, as the fake-port runner test does", async () => {
    expect(
      await walkerRunner.run({
        repoRoot: absolutePathSchema.parse("/repo"),
        installRoot: absolutePathSchema.parse("/install"),
        files: [repoPathSchema.parse("src/alpha.ts")],
        trackedPaths: [repoPathSchema.parse("src/alpha.ts")],
        clauses: [CLAUSE],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          clause: ADDRESS,
          file: "src/alpha.ts",
          anchor: { line: 3, column: 2 },
          snippet: "class Alpha {}",
        },
      ],
    });
  });
});
