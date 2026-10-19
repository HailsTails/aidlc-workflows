import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd41Plugin from "./cd41.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd41Plugin }).default;

const eslint = createDefaultEslintPort({});

const complexityFlagCases: readonly SourceCase[] = [
  {
    name: "six nested loops score twenty-one",
    fileName: repoPathSchema.parse("nested-loops.ts"),
    source: "function crawl(grid: number[][]): void {\n  for (const key in grid) {\n    for (const key in grid) {\n      for (const key in grid) {\n        for (const key in grid) {\n          for (const key in grid) {\n            for (const key in grid) {\n              console.log(b, d, f);\n            }\n          }\n        }\n      }\n    }\n  }\n}\n",
    expectedLines: [1],
  },
  {
    name: "a sixteen-branch else-if chain reports the arrow",
    fileName: repoPathSchema.parse("branchy-arrow.ts"),
    source: "export const route = (a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean, h: boolean, i: boolean, j: boolean, k: boolean, l: boolean, m: boolean, n: boolean, o: boolean, p: boolean): number => {\n  if (a) {\n    return 1;\n  } else if (b) {\n    return 2;\n  } else if (c) {\n    return 2;\n  } else if (d) {\n    return 2;\n  } else if (e) {\n    return 2;\n  } else if (f) {\n    return 2;\n  } else if (g) {\n    return 2;\n  } else if (h) {\n    return 2;\n  } else if (i) {\n    return 2;\n  } else if (j) {\n    return 2;\n  } else if (k) {\n    return 2;\n  } else if (l) {\n    return 2;\n  } else if (m) {\n    return 2;\n  } else if (n) {\n    return 2;\n  } else if (o) {\n    return 2;\n  } else if (p) {\n    return 2;\n  }\n  return 0;\n}\n",
    expectedLines: [1],
  },
];

const complexityAllowCases: readonly SourceCase[] = [
  {
    name: "a fifteen-branch else-if chain sits exactly on the limit",
    fileName: repoPathSchema.parse("limit-chain.ts"),
    source: "export function route(a: boolean, b: boolean, c: boolean, d: boolean, e: boolean, f: boolean, g: boolean, h: boolean, i: boolean, j: boolean, k: boolean, l: boolean, m: boolean, n: boolean, o: boolean): number {\n  if (a) {\n    return 1;\n  } else if (b) {\n    return 2;\n  } else if (c) {\n    return 2;\n  } else if (d) {\n    return 2;\n  } else if (e) {\n    return 2;\n  } else if (f) {\n    return 2;\n  } else if (g) {\n    return 2;\n  } else if (h) {\n    return 2;\n  } else if (i) {\n    return 2;\n  } else if (j) {\n    return 2;\n  } else if (k) {\n    return 2;\n  } else if (l) {\n    return 2;\n  } else if (m) {\n    return 2;\n  } else if (n) {\n    return 2;\n  } else if (o) {\n    return 2;\n  }\n  return 0;\n}\n",
    expectedLines: [],
  },
  {
    name: "five nested loops score fifteen",
    fileName: repoPathSchema.parse("five-loops.ts"),
    source: "function crawl(grid: number[][]): void {\n  for (const key in grid) {\n    for (const key in grid) {\n      for (const key in grid) {\n        for (const key in grid) {\n          for (const key in grid) {\n            console.log(b, d, e);\n          }\n        }\n      }\n    }\n  }\n}\n",
    expectedLines: [],
  },
  {
    name: "a switch counts once however many cases it has",
    fileName: repoPathSchema.parse("wide-switch.ts"),
    source: "export function label(code: number): string {\n  switch (code) {\n    case 1: return \"a\";\n    case 2: return \"b\";\n    case 3: return \"c\";\n    case 4: return \"d\";\n    case 5: return \"e\";\n    case 6: return \"f\";\n    case 7: return \"g\";\n    case 8: return \"h\";\n    case 9: return \"i\";\n    case 10: return \"j\";\n    case 11: return \"k\";\n    case 12: return \"l\";\n    case 13: return \"m\";\n    case 14: return \"n\";\n    case 15: return \"o\";\n    case 16: return \"p\";\n  }\n}\n",
    expectedLines: [],
  },
];

const lengthFlagCases: readonly SourceCase[] = [
  {
    name: "a function declaration with fifty-one body lines",
    fileName: repoPathSchema.parse("long-declaration.ts"),
    source: "export function sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n}\n",
    expectedLines: [1],
  },
  {
    name: "an arrow function with fifty-one body lines",
    fileName: repoPathSchema.parse("long-arrow.ts"),
    source: "export const sprawl = (): void => {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n};\n",
    expectedLines: [1],
  },
];

const lengthAllowCases: readonly SourceCase[] = [
  {
    name: "a function with exactly fifty body lines",
    fileName: repoPathSchema.parse("limit-length.ts"),
    source: "export function sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n}\n",
    expectedLines: [],
  },
  {
    name: "a getter is exempt from the length limit",
    fileName: repoPathSchema.parse("long-getter.ts"),
    source: "export const holder = {\n  get sprawl(): void {\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  step();\n  },\n};\n",
    expectedLines: [],
  },
  {
    name: "blank lines and braces do not count towards the length",
    fileName: repoPathSchema.parse("spaced-body.ts"),
    source: "export function spaced(): void {\n  if (ready()) {\n\n    step();\n\n  }\n}\n",
    expectedLines: [],
  },
];

describe("CD-41 cognitive-complexity rule through the ESLint runner's lintSourceCases", () => {
  it.each([...complexityFlagCases, ...complexityAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd41",
        rule: "cognitive-complexity",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});

describe("CD-41 function-length rule through the ESLint runner's lintSourceCases", () => {
  it.each([...lengthFlagCases, ...lengthAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd41",
        rule: "function-length",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
