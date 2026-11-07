import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd27Plugin from "./cd27.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd27Plugin }).default;

const eslint = createDefaultEslintPort({});

const focusedFlagCases: readonly SourceCase[] = [
  {
    name: "a chained modifier before only",
    fileName: repoPathSchema.parse("concurrent-only.ts"),
    source: "import { test } from \"vitest\";\ntest.concurrent.only(\"runs alone\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "a bracketed only member",
    fileName: repoPathSchema.parse("bracketed-only.ts"),
    source: "import { it } from \"vitest\";\nit[\"only\"](\"runs alone\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "an f-prefixed bare call",
    fileName: repoPathSchema.parse("bare-fit.ts"),
    source: "declare const fit: (name: string, run: () => void) => void;\nfit(\"runs alone\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "a suite root",
    fileName: repoPathSchema.parse("suite-only.ts"),
    source: "import { suite } from \"vitest\";\nsuite.only(\"runs alone\", () => {});\n",
    expectedLines: [2],
  },
];

const focusedAllowCases: readonly SourceCase[] = [
  {
    name: "only on an unrelated object",
    fileName: repoPathSchema.parse("unrelated-only.ts"),
    source: "declare const queue: { only: () => void };\nqueue.only();\n",
    expectedLines: [],
  },
  {
    name: "a skip modifier is not a focus",
    fileName: repoPathSchema.parse("skip-modifier.ts"),
    source: "import { it } from \"vitest\";\nit.skip(\"is parked\", () => {});\n",
    expectedLines: [],
  },
  {
    name: "each called before the test body",
    fileName: repoPathSchema.parse("each-call.ts"),
    source: "import { test } from \"vitest\";\ntest.each([1, 2])(\"runs %i\", () => {});\n",
    expectedLines: [],
  },
  {
    name: "an identifier that only resembles a focus",
    fileName: repoPathSchema.parse("onlyfn.ts"),
    source: "declare const onlyFn: () => void;\nonlyFn();\n",
    expectedLines: [],
  },
];

const skippedFlagCases: readonly SourceCase[] = [
  {
    name: "a chained modifier before skip",
    fileName: repoPathSchema.parse("concurrent-skip.ts"),
    source: "import { test } from \"vitest\";\ntest.concurrent.skip(\"is parked\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "a bracketed skip member",
    fileName: repoPathSchema.parse("bracketed-skip.ts"),
    source: "import { it } from \"vitest\";\nit[\"skip\"](\"is parked\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "an x-prefixed bare call",
    fileName: repoPathSchema.parse("bare-xit.ts"),
    source: "declare const xit: (name: string, run: () => void) => void;\nxit(\"is parked\", () => {});\n",
    expectedLines: [2],
  },
  {
    name: "a fixme modifier",
    fileName: repoPathSchema.parse("fixme-modifier.ts"),
    source: "import { test } from \"vitest\";\ntest.fixme(\"is broken\", () => {});\n",
    expectedLines: [2],
  },
];

const skippedAllowCases: readonly SourceCase[] = [
  {
    name: "skip on an unrelated object",
    fileName: repoPathSchema.parse("unrelated-skip.ts"),
    source: "declare const cursor: { skip: (count: number) => void };\ncursor.skip(3);\n",
    expectedLines: [],
  },
  {
    name: "an only modifier is not a skip",
    fileName: repoPathSchema.parse("only-modifier.ts"),
    source: "import { it } from \"vitest\";\nit.only(\"runs alone\", () => {});\n",
    expectedLines: [],
  },
  {
    name: "an f-prefixed call is not a skip",
    fileName: repoPathSchema.parse("bare-fit-skipped.ts"),
    source: "declare const fit: (name: string, run: () => void) => void;\nfit(\"runs alone\", () => {});\n",
    expectedLines: [],
  },
];

describe("CD-27 focused-tests rule through the ESLint runner's lintSourceCases", () => {
  it.each([...focusedFlagCases, ...focusedAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd27",
        rule: "focused-tests",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});

describe("CD-27 skipped-tests rule through the ESLint runner's lintSourceCases", () => {
  it.each([...skippedFlagCases, ...skippedAllowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd27",
        rule: "skipped-tests",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
