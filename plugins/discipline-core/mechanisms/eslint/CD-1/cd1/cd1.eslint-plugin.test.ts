import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd1Plugin from "./cd1.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd1Plugin }).default;

const eslint = createDefaultEslintPort({});

const anyFlagCases: readonly SourceCase[] = [
  {
    name: "any as an array element type",
    fileName: repoPathSchema.parse("any-array.ts"),
    source: "const total = 1;\nexport const count = (input: any[]): number => input.length + total;\n",
    expectedLines: [2],
  },
  {
    name: "any as a generic default",
    fileName: repoPathSchema.parse("any-default.ts"),
    source: "export const identity = <Subject = any>(subject: Subject): Subject => subject;\n",
    expectedLines: [1],
  },
  {
    name: "any inside a type literal member",
    fileName: repoPathSchema.parse("any-member.ts"),
    source: "export type Box = {\n  readonly label: string;\n  readonly content: any;\n};\n",
    expectedLines: [3],
  },
];

const anyAllowCases: readonly SourceCase[] = [
  {
    name: "unknown is the sanctioned open type",
    fileName: repoPathSchema.parse("unknown-type.ts"),
    source: "export const accept = (input: unknown): boolean => input !== null;\n",
    expectedLines: [],
  },
  {
    name: "an identifier that merely contains any",
    fileName: repoPathSchema.parse("any-identifier.ts"),
    source: "export const anything = 1;\nexport const companyName = \"any\";\n",
    expectedLines: [],
  },
];

const implicitFlagCases: readonly SourceCase[] = [
  {
    name: "a bare let declaration",
    fileName: repoPathSchema.parse("bare-let.ts"),
    source: "let pending;\npending = 1;\nexport { pending };\n",
    expectedLines: [1],
  },
  {
    name: "a bare var declaration inside a function",
    fileName: repoPathSchema.parse("bare-var.ts"),
    source: "export function run(): void {\n  var legacy;\n  legacy = 1;\n}\n",
    expectedLines: [2],
  },
  {
    name: "the first untyped declarator among several",
    fileName: repoPathSchema.parse("mixed-declarators.ts"),
    source: "const ready = 1;\nlet counted: number = 1, loose;\nloose = ready;\nexport { counted, loose };\n",
    expectedLines: [2],
  },
  {
    name: "a tsx file is governed",
    fileName: repoPathSchema.parse("bare-let.tsx"),
    source: "let element;\nelement = 1;\nexport { element };\n",
    expectedLines: [1],
  },
];

const implicitAllowCases: readonly SourceCase[] = [
  {
    name: "a let with a type annotation",
    fileName: repoPathSchema.parse("typed-let.ts"),
    source: "let counted: number;\ncounted = 1;\nexport { counted };\n",
    expectedLines: [],
  },
  {
    name: "a let with an initialiser",
    fileName: repoPathSchema.parse("initialised-let.ts"),
    source: "let counted = 0;\ncounted += 1;\nexport { counted };\n",
    expectedLines: [],
  },
  {
    name: "a let in a for-in loop head",
    fileName: repoPathSchema.parse("for-in-head.ts"),
    source: "export function keys(record: Record<string, number>): number {\n  let total = 0;\n  for (let key in record) {\n    total += record[key] ?? 0;\n  }\n  return total;\n}\n",
    expectedLines: [],
  },
  {
    name: "a var in a second for-in loop head",
    fileName: repoPathSchema.parse("for-of-head.ts"),
    source: "export function sum(numbers: number[]): number {\n  let total = 0;\n  for (var next in numbers) {\n    total += next;\n  }\n  return total;\n}\n",
    expectedLines: [],
  },
  {
    name: "a javascript file is not governed",
    fileName: repoPathSchema.parse("bare-let.js"),
    source: "let pending;\npending = 1;\nexport { pending };\n",
    expectedLines: [],
  },
];

describe("CD-1 no-explicit-any rule through the ESLint runner's lintSourceCases", () => {
  it.each([...anyFlagCases, ...anyAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd1",
        rule: "no-explicit-any",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});

describe("CD-1 implicit-any-let rule through the ESLint runner's lintSourceCases", () => {
  it.each([...implicitFlagCases, ...implicitAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd1",
        rule: "implicit-any-let",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
