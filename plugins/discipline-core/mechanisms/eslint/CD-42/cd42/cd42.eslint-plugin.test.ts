import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd42Plugin from "./cd42.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd42Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "else after a throwing branch",
    fileName: repoPathSchema.parse("else-after-throw.ts"),
    source: "export function check(ready: boolean): number {\n  if (!ready) {\n    throw new Error(\"not ready\");\n  } else {\n    return 1;\n  }\n}\n",
    expectedLines: [4],
  },
  {
    name: "else after continue in a loop",
    fileName: repoPathSchema.parse("else-after-continue.ts"),
    source: "export function sum(numbers: number[]): number {\n  let total = 0;\n  for (const next in numbers) {\n    if (next < 0) {\n      continue;\n    } else {\n      total += next;\n    }\n  }\n  return total;\n}\n",
    expectedLines: [6],
  },
  {
    name: "else after break in a loop",
    fileName: repoPathSchema.parse("else-after-break.ts"),
    source: "export function sum(numbers: number[]): number {\n  let total = 0;\n  for (const next in numbers) {\n    if (next < 0) break;\n    else total += next;\n  }\n  return total;\n}\n",
    expectedLines: [5],
  },
  {
    name: "every else in an exiting chain",
    fileName: repoPathSchema.parse("exiting-chain.ts"),
    source: "export function grade(score: number): string {\n  if (score > 90) {\n    return \"a\";\n  } else if (score > 50) {\n    return \"b\";\n  } else {\n    return \"c\";\n  }\n}\n",
    expectedLines: [4, 6],
  },
  {
    name: "else after an if whose branches both exit",
    fileName: repoPathSchema.parse("nested-exits.ts"),
    source: "export function pick(left: boolean, right: boolean): number {\n  if (left) {\n    if (right) {\n      return 1;\n    } else {\n      return 2;\n    }\n  } else {\n    return 3;\n  }\n}\n",
    expectedLines: [5, 8],
  },
  {
    name: "else after a switch whose cases all return",
    fileName: repoPathSchema.parse("switch-exits.ts"),
    source: "export function pick(code: number, extra: boolean): number {\n  if (extra) {\n    switch (code) {\n      case 1:\n        return 1;\n      case 2:\n        return 2;\n    }\n  } else {\n    return 3;\n  }\n}\n",
    expectedLines: [9],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "an if without an else",
    fileName: repoPathSchema.parse("no-else.ts"),
    source: "export function check(ready: boolean): number {\n  if (!ready) {\n    throw new Error(\"not ready\");\n  }\n  return 1;\n}\n",
    expectedLines: [],
  },
  {
    name: "a branch that falls through",
    fileName: repoPathSchema.parse("falls-through.ts"),
    source: "export function check(ready: boolean): number {\n  let level = 0;\n  if (ready) {\n    level = 1;\n  } else {\n    level = 2;\n  }\n  return level;\n}\n",
    expectedLines: [],
  },
  {
    name: "a nested if with no else leaves the outer branch open",
    fileName: repoPathSchema.parse("open-inner.ts"),
    source: "export function pick(left: boolean, right: boolean): number {\n  if (left) {\n    if (right) {\n      return 1;\n    }\n  } else {\n    return 3;\n  }\n  return 0;\n}\n",
    expectedLines: [],
  },
  {
    name: "a switch with a non-exiting case",
    fileName: repoPathSchema.parse("switch-falls.ts"),
    source: "export function pick(code: number, extra: boolean): number {\n  let level = 0;\n  if (extra) {\n    switch (code) {\n      case 1:\n        level = 1;\n        break;\n      case 2:\n        return 2;\n    }\n  } else {\n    level = 3;\n  }\n  return level;\n}\n",
    expectedLines: [],
  },
  {
    name: "an empty switch",
    fileName: repoPathSchema.parse("empty-switch.ts"),
    source: "export function pick(code: number, extra: boolean): number {\n  if (extra) {\n    switch (code) {\n    }\n  } else {\n    return 3;\n  }\n  return 0;\n}\n",
    expectedLines: [],
  },
];

describe("CD-42 useless-else rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd42",
        rule: "useless-else",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
