import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd44Plugin from "./cd44.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd44Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "a compound assignment to a parameter",
    fileName: repoPathSchema.parse("compound-assignment.ts"),
    source: "export function grow(size: number): number {\n  size += 1;\n  return size;\n}\n",
    expectedLines: [2],
  },
  {
    name: "an increment of an arrow parameter",
    fileName: repoPathSchema.parse("arrow-increment.ts"),
    source: "export const bump = (count: number): number => {\n  count++;\n  return count;\n};\n",
    expectedLines: [2],
  },
  {
    name: "a destructured parameter being reassigned",
    fileName: repoPathSchema.parse("destructured-param.ts"),
    source: "export function read({ label }: { label: string }): string {\n  label = label.trim();\n  return label;\n}\n",
    expectedLines: [2],
  },
  {
    name: "a default valued parameter being reassigned",
    fileName: repoPathSchema.parse("default-param.ts"),
    source: "export function grow(size: number = 1): number {\n  size = size * 2;\n  return size;\n}\n",
    expectedLines: [2],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "mutating a property of a parameter",
    fileName: repoPathSchema.parse("property-write.ts"),
    source: "export function rename(target: { label: string }, label: string): void {\n  target.label = label;\n}\n",
    expectedLines: [],
  },
  {
    name: "reassigning a local variable",
    fileName: repoPathSchema.parse("local-reassign.ts"),
    source: "export function grow(size: number): number {\n  let grown = size;\n  grown += 1;\n  return grown;\n}\n",
    expectedLines: [],
  },
  {
    name: "a shadowing local with the parameter name",
    fileName: repoPathSchema.parse("shadowed-local.ts"),
    source: "export function grow(size: number): number {\n  {\n    let size = 2;\n    size = 3;\n  }\n  return size;\n}\n",
    expectedLines: [],
  },
  {
    name: "reading a parameter",
    fileName: repoPathSchema.parse("read-only.ts"),
    source: "export const double = (size: number): number => size * 2;\n",
    expectedLines: [],
  },
];

describe("CD-44 no-param-reassign rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd44",
        rule: "no-param-reassign",
        options: [{ props: false }],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
