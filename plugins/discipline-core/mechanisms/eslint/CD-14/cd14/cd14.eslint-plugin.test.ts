import { assert, describe, expect, it, test, vi } from "vitest";
import type { FileTextPort } from "../../../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../../../core/platform-ports/path-port.ts";
import {
  type ClauseDefinition,
  readDisciplineFile,
  type SourceCase,
} from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { disciplineIdSchema } from "../../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import discipline from "../../../../rules/CD-14/discipline.json" with { type: "json" };
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import classAuthoringPlugin, { classDisposition, containerMode } from "./cd14.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

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

const keywordAfterNodeStartCases: readonly SourceCase[] = [
  {
    name: "decorator on the line before the class keyword",
    fileName: repoPathSchema.parse("decorated.ts"),
    source: "@sealed\nclass Alpha {}\n",
    expectedLines: [2],
  },
  {
    name: "decorated class expression",
    fileName: repoPathSchema.parse("decorated-expression.ts"),
    source: "export const Gamma = @sealed\nclass {};\n",
    expectedLines: [2],
  },
];

const loadedPlugin = eslintPluginModuleSchema.parse({ default: classAuthoringPlugin }).default;

const eslint = createDefaultEslintPort({});

test("runtime class declarations are reported", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("class expressions stay runtime syntax", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "expression",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

test("ambient class declarations are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "ambient",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("declaration files are type-only", () => {
  expect(
    classDisposition({
      filename: "src/external.d.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("allow");
});

test("classes enclosed by ambient modules are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "ambient",
    }),
  ).toBe("allow");
});

test("the parent walk reaches an ambient module through an ordinary ancestor", () => {
  expect(
    containerMode({
      node: {
        type: "ClassBody",
        parent: { type: "TSModuleDeclaration", declare: true, parent: null },
      },
    }),
  ).toBe("ambient");
});

test("runtime namespaces do not provide an ambient exemption", () => {
  expect(containerMode({ node: { type: "TSModuleDeclaration", parent: null } })).toBe("runtime");
});

test("an unrelated declared node does not provide an ambient exemption", () => {
  expect(
    containerMode({
      node: { type: "VariableDeclaration", declare: true, parent: null },
    }),
  ).toBe("runtime");
});

describe("CD-14 no-class-authoring rule through the ESLint runner's lintSourceCases", () => {
  it.each([
    ...sharedCases.flag,
    ...sharedCases.allow,
    ...keywordAfterNodeStartCases,
  ])("flags exactly the expected lines of the case $name", async (sharedCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline",
        rule: "no-class-authoring",
        options: [],
        cases: [sharedCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sharedCase.name, flaggedLines: sharedCase.expectedLines }],
    });
  });
});
