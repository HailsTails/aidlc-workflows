import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd40Plugin from "./cd40.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd40Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "a function declaration with three parameters",
    fileName: repoPathSchema.parse("three-params.ts"),
    source: "export function combine(first: number, second: number, third: number): number {\n  return first + second + third;\n}\n",
    expectedLines: [1],
  },
  {
    name: "an arrow function with three parameters",
    fileName: repoPathSchema.parse("arrow-three.ts"),
    source: "export const combine = (first: number, second: number, third: number): number => first + second + third;\n",
    expectedLines: [1],
  },
  {
    name: "a method with three parameters",
    fileName: repoPathSchema.parse("method-three.ts"),
    source: "export const holder = {\n  combine(first: number, second: number, third: number): number {\n    return first + second + third;\n  },\n};\n",
    expectedLines: [2],
  },
  {
    name: "a typed this parameter counts towards the limit",
    fileName: repoPathSchema.parse("typed-this.ts"),
    source: "interface Counter {\n  total: number;\n}\nexport function combine(this: Counter, first: number, second: number): number {\n  return this.total + first + second;\n}\n",
    expectedLines: [4],
  },
  {
    name: "a void this parameter counts towards the limit",
    fileName: repoPathSchema.parse("void-this.ts"),
    source: "export function combine(this: void, first: number, second: number): number {\n  return first + second;\n}\n",
    expectedLines: [1],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "a void this parameter with a single real parameter",
    fileName: repoPathSchema.parse("void-this-single.ts"),
    source: "export function read(this: void, first: number): number {\n  return first;\n}\n",
    expectedLines: [],
  },
  {
    name: "two parameters",
    fileName: repoPathSchema.parse("two-params.ts"),
    source: "export function combine(first: number, second: number): number {\n  return first + second;\n}\n",
    expectedLines: [],
  },
  {
    name: "a single options object",
    fileName: repoPathSchema.parse("options-object.ts"),
    source: "export function combine(request: { first: number; second: number; third: number }): number {\n  return request.first + request.second + request.third;\n}\n",
    expectedLines: [],
  },
  {
    name: "no parameters",
    fileName: repoPathSchema.parse("no-params.ts"),
    source: "export const answer = (): number => 42;\n",
    expectedLines: [],
  },
];

describe("CD-40 max-params rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd40",
        rule: "max-params",
        options: [{ max: 2, countVoidThis: true }],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
