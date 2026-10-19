import { describe, expect, it } from "vitest";
import type { SourceCase } from "../../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../../core/values/repo-path.ts";
import { createDefaultEslintPort } from "../../runner/eslint-instance.ts";
import { eslintPluginModuleSchema } from "../../runner/eslint-plugin-schema.ts";
import cd7Plugin from "./cd7.eslint-plugin.ts";

const PIECE_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/..`);

const loadedPlugin = eslintPluginModuleSchema.parse({ default: cd7Plugin }).default;

const eslint = createDefaultEslintPort({});

const flagCases: readonly SourceCase[] = [
  {
    name: "snake case with an interior underscore",
    fileName: repoPathSchema.parse("src/snake_case.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "camel case",
    fileName: repoPathSchema.parse("src/camelCase.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "all capitals",
    fileName: repoPathSchema.parse("src/UPPER.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a space in the name",
    fileName: repoPathSchema.parse("src/my file.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a non-conventional second extension segment",
    fileName: repoPathSchema.parse("src/widget.Test_Spec.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
  {
    name: "a route group followed by garbage",
    fileName: repoPathSchema.parse("src/(group)extra.ts"),
    source: "export {};\n",
    expectedLines: [1],
  },
];

const allowCases: readonly SourceCase[] = [
  {
    name: "kebab case with a test extension",
    fileName: repoPathSchema.parse("src/kebab-case.test.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "pascal case component",
    fileName: repoPathSchema.parse("src/Component.tsx"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "edge underscores are stripped",
    fileName: repoPathSchema.parse("src/__init__.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a leading dot marker is stripped",
    fileName: repoPathSchema.parse("src/.config-file.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a leading plus marker is stripped",
    fileName: repoPathSchema.parse("src/+page.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a dynamic route segment",
    fileName: repoPathSchema.parse("src/[id].ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "a catch-all route segment with extensions",
    fileName: repoPathSchema.parse("src/[...slug].page.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
  {
    name: "only the basename is judged, not its directories",
    fileName: repoPathSchema.parse("src/Bad_Directory/ok-name.ts"),
    source: "export {};\n",
    expectedLines: [],
  },
];

describe("CD-7 filename-case rule through the ESLint runner's lintSourceCases", () => {
  it.each([...flagCases, ...allowCases])("flags exactly the expected lines of the case $name", async (sourceCase) => {
    expect(
      await eslint.lintSourceCases({
        cwd: PIECE_ROOT,
        plugin: loadedPlugin,
        pluginNamespace: "discipline-cd7",
        rule: "filename-case",
        options: [],
        cases: [sourceCase],
      }),
    ).toEqual({
      outcome: "ok",
      value: [{ caseName: sourceCase.name, flaggedLines: sourceCase.expectedLines }],
    });
  });
});
