import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd10Plugin from "./cd10.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd10Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "a logical expression with a literal operand",
    fileName: repoPathSchema.parse("logical-literal.ts"),
    source: "export function fail(cause: Error | undefined): never {\n  throw cause || \"unknown\";\n}\n",
    expectedLines: [2],
  },
  {
    name: "a conditional with a literal branch",
    fileName: repoPathSchema.parse("conditional-literal.ts"),
    source: "export function fail(urgent: boolean): never {\n  throw urgent ? new Error(\"urgent\") : \"routine\";\n}\n",
    expectedLines: [2],
  },
  {
    name: "an assignment of a literal",
    fileName: repoPathSchema.parse("assigned-literal.ts"),
    source: "let latest: unknown;\nexport function fail(): never {\n  throw (latest = \"stale\");\n}\n",
    expectedLines: [3],
  },
  {
    name: "the last operand of a sequence",
    fileName: repoPathSchema.parse("sequence-literal.ts"),
    source: "export function fail(): never {\n  throw (console.log(\"failing\"), 42);\n}\n",
    expectedLines: [2],
  },
  {
    name: "a binary expression",
    fileName: repoPathSchema.parse("binary-expression.ts"),
    source: "export function fail(code: number): never {\n  throw code + 1;\n}\n",
    expectedLines: [2],
  },
  {
    name: "a tagged template",
    fileName: repoPathSchema.parse("tagged-template.ts"),
    source: "declare const tag: (parts: TemplateStringsArray) => string;\nexport function fail(): never {\n  throw tag`broken`;\n}\n",
    expectedLines: [3],
  },
  {
    name: "the undefined identifier",
    fileName: repoPathSchema.parse("thrown-undefined.ts"),
    source: "export function fail(): never {\n  throw undefined;\n}\n",
    expectedLines: [2],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "a constructed error",
    fileName: repoPathSchema.parse("constructed-error.ts"),
    source: "export function fail(): never {\n  throw new TypeError(\"bad\");\n}\n",
    expectedLines: [],
  },
  {
    name: "a caught identifier rethrown",
    fileName: repoPathSchema.parse("rethrown.ts"),
    source: "export function guard(run: () => void): void {\n  try {\n    run();\n  } catch (caught) {\n    throw caught;\n  }\n}\n",
    expectedLines: [],
  },
  {
    name: "a call that produces an error",
    fileName: repoPathSchema.parse("error-factory.ts"),
    source: "declare const buildError: () => Error;\nexport function fail(): never {\n  throw buildError();\n}\n",
    expectedLines: [],
  },
  {
    name: "a logical expression of two possible errors",
    fileName: repoPathSchema.parse("logical-identifiers.ts"),
    source: "export function fail(first: Error, second: Error): never {\n  throw first ?? second;\n}\n",
    expectedLines: [],
  },
  {
    name: "a conditional between two constructed errors",
    fileName: repoPathSchema.parse("conditional-errors.ts"),
    source: "export function fail(urgent: boolean): never {\n  throw urgent ? new Error(\"urgent\") : new RangeError(\"routine\");\n}\n",
    expectedLines: [],
  },
  {
    name: "an assignment of a possible error",
    fileName: repoPathSchema.parse("assigned-error.ts"),
    source: "let latest: Error | undefined;\nexport function fail(next: Error): never {\n  throw (latest = next);\n}\n",
    expectedLines: [],
  },
];

describe("CD-10 throw-only-error rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd10",
        rule: "throw-only-error",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
