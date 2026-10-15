import { describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import {
  type CreateEslint,
  createEslintPort,
  defaultCreateEslint,
  type EslintSurface,
  governanceConfig,
  type LintedFile,
} from "./eslint-instance.ts";
import { eslintPluginModuleSchema } from "./eslint-plugin-schema.ts";

type ReportingContext = {
  readonly report: (descriptor: { readonly node: unknown; readonly messageId: string }) => void;
};

const classAndFunctionPlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      "no-class": {
        meta: { type: "problem", messages: { found: "class authored" } },
        create: (context: ReportingContext) => ({
          ClassDeclaration: (node: unknown) => context.report({ node, messageId: "found" }),
        }),
      },
      "no-function": {
        meta: { type: "problem", messages: { found: "function declared" } },
        create: (context: ReportingContext) => ({
          FunctionDeclaration: (node: unknown) => context.report({ node, messageId: "found" }),
        }),
      },
    },
  },
}).default;

const tmpFilePlugin = eslintPluginModuleSchema.parse({
  default: {
    rules: {
      "no-tmp": { meta: { type: "problem" }, create: () => ({}) },
    },
  },
}).default;

const repoRoot = absolutePathSchema.parse("/repo");
const conformanceRoot = absolutePathSchema.parse("/install/mechanisms/eslint/CD-14");
const fileA = repoPathSchema.parse("src/a.ts");
const fileB = repoPathSchema.parse("src/b.ts");

const classCase = {
  name: "class",
  fileName: repoPathSchema.parse("cases/class.ts"),
  source: "const a = 1;\nclass A {}\n",
  expectedLines: [2],
};

const functionAndClassCase = {
  name: "function-and-class",
  fileName: repoPathSchema.parse("cases/function-and-class.ts"),
  source: "function f() {}\nclass A {}\n",
  expectedLines: [2],
};

const disabledClassCase = {
  name: "disabled-class",
  fileName: repoPathSchema.parse("cases/disabled-class.ts"),
  source: "/* eslint-disable */\nclass A {}\n",
  expectedLines: [2],
};

const REFUSED_CONFIG_DETAIL =
  "[\n  {\n    \"code\": \"invalid_union\",\n    \"errors\": [\n      [\n        {\n          \"expected\": \"undefined\",\n          \"code\": \"invalid_type\",\n          \"path\": [],\n          \"message\": \"Invalid input: expected undefined, received object\"\n        }\n      ],\n      [\n        {\n          \"code\": \"invalid_union\",\n          \"errors\": [\n            [\n              {\n                \"code\": \"invalid_value\",\n                \"values\": [\n                  0\n                ],\n                \"path\": [],\n                \"message\": \"Invalid input: expected 0\"\n              }\n            ],\n            [\n              {\n                \"code\": \"invalid_value\",\n                \"values\": [\n                  1\n                ],\n                \"path\": [],\n                \"message\": \"Invalid input: expected 1\"\n              }\n            ],\n            [\n              {\n                \"code\": \"invalid_value\",\n                \"values\": [\n                  2\n                ],\n                \"path\": [],\n                \"message\": \"Invalid input: expected 2\"\n              }\n            ]\n          ],\n          \"path\": [\n            \"rules\",\n            \"cd/no-class\",\n            0\n          ],\n          \"message\": \"Invalid input\"\n        }\n      ]\n    ],\n    \"path\": [],\n    \"message\": \"Invalid input\"\n  }\n]";

const noClassCase = {
  name: "no-class",
  fileName: repoPathSchema.parse("cases/no-class.ts"),
  source: "const a = 1;\n",
  expectedLines: [],
};

const lintedA: LintedFile = {
  filePath: "/repo/src/a.ts",
  messages: [{ ruleId: "cd/no-class", line: 2, column: 1, message: "class authored" }],
};

const idleSurface: EslintSurface = {
  isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(false),
  calculateConfigForFile: vi
    .fn<EslintSurface["calculateConfigForFile"]>()
    .mockResolvedValue(undefined),
  lintFiles: vi.fn<EslintSurface["lintFiles"]>().mockResolvedValue([]),
  lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([]),
};

const throwsOnBuild = vi
  .fn<CreateEslint>()
  .mockThrow(new Error("Invalid Options: unknown option"));

const lintsGovernanceText = (request: { readonly code: string }) =>
  defaultCreateEslint({
    options: {
      cwd: absolutePathSchema.parse("/conformance"),
      overrideConfigFile: true,
      ignore: false,
      allowInlineConfig: false,
      overrideConfig: governanceConfig({
        plugins: { cd: classAndFunctionPlugin },
        ruleIds: ["cd/no-class"],
      }),
    },
  }).lintText({ code: request.code, filePath: "src/a.ts" });

describe("governanceConfig", () => {
  it("builds one block for TypeScript files", () => {
    expect(
      governanceConfig({ plugins: { cd: classAndFunctionPlugin }, ruleIds: ["cd/no-class"] }),
    ).toMatchObject({ files: ["**/*.{ts,tsx,mts,cts}"] });
  });

  it("sets each selected rule id and the inline-config rule to error, with no options", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin, pd: tmpFilePlugin },
        ruleIds: ["cd/no-class", "pd/no-tmp"],
      }).rules,
    ).toEqual({
      "cd/no-class": "error",
      "pd/no-tmp": "error",
      "discipline-core/inline-config": "error",
    });
  });

  it("registers each plugin under its namespace beside the discipline-core plugin carrying inline-config", () => {
    expect(
      governanceConfig({
        plugins: { cd: classAndFunctionPlugin, pd: tmpFilePlugin },
        ruleIds: ["cd/no-class", "pd/no-tmp"],
      }).plugins,
    ).toEqual({
      cd: classAndFunctionPlugin,
      pd: tmpFilePlugin,
      "discipline-core": expect.objectContaining({
        rules: { "inline-config": expect.objectContaining({ create: expect.any(Function) }) },
      }),
    });
  });

  it("parses with the TypeScript parser and its default options", () => {
    expect(
      governanceConfig({ plugins: { cd: classAndFunctionPlugin }, ruleIds: ["cd/no-class"] })
        .languageOptions,
    ).toEqual({ parser: expect.objectContaining({ parseForESLint: expect.any(Function) }) });
  });
});

describe("lintSourceCases over ESLint", () => {
  it("returns each case's flagged lines for the requested rule", async () => {
    const verdicts = await createEslintPort({ createEslint: defaultCreateEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase, noClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [
        { caseName: "class", flaggedLines: [2] },
        { caseName: "no-class", flaggedLines: [] },
      ],
    });
  });

  it("does not flag lines for another rule of the same plugin", async () => {
    const verdicts = await createEslintPort({ createEslint: defaultCreateEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [functionAndClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [{ caseName: "function-and-class", flaggedLines: [2] }],
    });
  });

  it("ignores the inline-config message and is not silenced by a disable comment", async () => {
    const verdicts = await createEslintPort({ createEslint: defaultCreateEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [disabledClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "ok",
      value: [{ caseName: "disabled-class", flaggedLines: [2] }],
    });
  });
});

describe("the discipline-core/inline-config rule over ESLint", () => {
  it.each([
    { form: "a disable naming no rule", code: "/* eslint-disable */\nconst a = 1;\n", line: 1 },
    {
      form: "a disable naming the selected rule",
      code: "const a = 1;\n/* eslint-disable cd/no-class */\n",
      line: 2,
    },
    {
      form: "a disable-line naming the selected rule",
      code: "const a = 1; // eslint-disable-line cd/no-class\n",
      line: 1,
    },
    {
      form: "a disable-next-line naming the selected rule",
      code: "// eslint-disable-next-line cd/no-class\nconst a = 1;\n",
      line: 1,
    },
    {
      form: "a disable naming the selected rule among others, with a justification",
      code: "/* eslint-disable no-console, cd/no-class -- generated */\n",
      line: 1,
    },
  ])("reports $form as inline-disable on its line", async ({ code, line }) => {
    expect(await lintsGovernanceText({ code })).toMatchObject([
      {
        messages: [{ ruleId: "discipline-core/inline-config", messageId: "inline-disable", line }],
      },
    ]);
  });

  it("reports a rule-config comment turning the selected rule off as inline-rule-config on its line", async () => {
    expect(
      await lintsGovernanceText({ code: 'const a = 1;\n/* eslint cd/no-class: "off" */\n' }),
    ).toMatchObject([
      {
        messages: [
          { ruleId: "discipline-core/inline-config", messageId: "inline-rule-config", line: 2 },
        ],
      },
    ]);
  });

  it.each([
    {
      form: "a block disable",
      code: "const a = 1;\n  /* eslint-disable cd/no-class */  \n",
      text: "/* eslint-disable cd/no-class */",
    },
    {
      form: "a line disable",
      code: "const a = 1; // eslint-disable-line cd/no-class\n",
      text: "// eslint-disable-line cd/no-class",
    },
    {
      form: "a rule-config comment",
      code: '/* eslint cd/no-class: "off" */\n',
      text: '/* eslint cd/no-class: "off" */',
    },
  ])("carries $form exactly as written in source, trimmed, as its message", async ({ code, text }) => {
    expect(await lintsGovernanceText({ code })).toMatchObject([
      { messages: [{ ruleId: "discipline-core/inline-config", message: text }] },
    ]);
  });

  it("reports an eslint comment whose configuration does not parse as inline-rule-config", async () => {
    expect(await lintsGovernanceText({ code: "/* eslint cd/no-class: [ */\n" })).toMatchObject([
      {
        messages: [
          { ruleId: "discipline-core/inline-config", messageId: "inline-rule-config", line: 1 },
        ],
      },
    ]);
  });

  it.each([
    { form: "a disable naming only another rule", code: "/* eslint-disable no-console */\n" },
    { form: "a rule-config comment for another rule", code: '/* eslint no-console: "off" */\n' },
    { form: "an enable comment", code: "/* eslint-enable */\n" },
    { form: "an enable comment naming the selected rule", code: "/* eslint-enable cd/no-class */\n" },
    { form: "a global comment", code: "/* global foo */\n" },
    { form: "an exported comment", code: "/* exported foo */\n" },
    { form: "a comment that is not a directive", code: "/* not a directive */\n" },
  ])("reports nothing for $form", async ({ code }) => {
    expect(await lintsGovernanceText({ code })).toMatchObject([{ messages: [] }]);
  });
});

describe("the discipline-core/inline-config rule over a malformed node list", () => {
  it("reports inline-config-unreadable without throwing", () => {
    const report = vi.fn();

    governanceConfig({ plugins: { cd: classAndFunctionPlugin }, ruleIds: ["cd/no-class"] })
      .plugins["discipline-core"].rules["inline-config"].create({
        sourceCode: { getInlineConfigNodes: vi.fn().mockReturnValue([{}]) },
        report,
      })
      .Program();

    expect(report.mock.calls).toEqual([
      [expect.objectContaining({ messageId: "inline-config-unreadable" })],
    ]);
  });
});

describe("createQueryInstance", () => {
  it("builds ESLint on the team's own configuration, with the repository root as its only option", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await createEslintPort({ createEslint }).createQueryInstance({ repoRoot }).ignoredState({
      file: fileA,
    });

    expect(createEslint).toHaveBeenCalledWith({ options: { cwd: "/repo" } });
  });

  it("builds ESLint once for every query of one instance", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);
    const queryInstance = createEslintPort({ createEslint }).createQueryInstance({ repoRoot });

    await queryInstance.ignoredState({ file: fileA });
    await queryInstance.ruleState({ file: fileB, ruleId: "cd/no-class" });

    expect(createEslint).toHaveBeenCalledTimes(1);
  });

  it("answers ignored for a path ESLint ignores", async () => {
    const ignoredState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(true),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({ outcome: "ok", value: "ignored" });
  });

  it("answers checked for a path ESLint does not ignore", async () => {
    const ignoredState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(false),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({ outcome: "ok", value: "checked" });
  });

  it("asks ESLint whether the requested file is ignored", async () => {
    const isPathIgnored = vi.fn<EslintSurface["isPathIgnored"]>().mockResolvedValue(false);

    await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, isPathIgnored }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(isPathIgnored).toHaveBeenCalledWith({ filePath: "src/a.ts" });
  });

  it("reads a rule's state from the requested file's resolved configuration", async () => {
    const calculateConfigForFile = vi
      .fn<EslintSurface["calculateConfigForFile"]>()
      .mockResolvedValue({ rules: { "cd/no-class": [2] } });

    const ruleState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, calculateConfigForFile }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileB, ruleId: "cd/no-class" });

    expect([ruleState, calculateConfigForFile.mock.calls]).toEqual([
      { outcome: "ok", value: { state: "configured", severity: 2 } },
      [[{ filePath: "src/b.ts" }]],
    ]);
  });

  it("reads an undefined resolved configuration as file-ignored", async () => {
    const ruleState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue(idleSurface),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({ outcome: "ok", value: { state: "file-ignored" } });
  });

  it("reports a resolved configuration the schema refuses as runner-invalid-output", async () => {
    const ruleState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockResolvedValue({ rules: { "cd/no-class": ["error"] } }),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({ outcome: "failed", error: { kind: "runner-invalid-output", detail: REFUSED_CONFIG_DETAIL } });
  });

  it("reports ESLint refusing to redefine a plugin while answering a rule state as plugin-conflict", async () => {
    const ruleState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockRejectedValue(new Error('Config "team": Key "plugins": Cannot redefine plugin "cd".')),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({
      outcome: "failed",
      error: {
        kind: "plugin-conflict",
        detail: 'Config "team": Key "plugins": Cannot redefine plugin "cd".',
      },
    });
  });

  it("reports ESLint refusing to redefine a plugin while answering an ignore as plugin-conflict", async () => {
    const ignoredState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi
          .fn<EslintSurface["isPathIgnored"]>()
          .mockRejectedValue(new Error('Cannot redefine plugin "cd".')),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toMatchObject({ outcome: "failed", error: { kind: "plugin-conflict" } });
  });

  it("reports any other rejection while answering a rule state as team-config-unloadable", async () => {
    const ruleState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        calculateConfigForFile: vi
          .fn<EslintSurface["calculateConfigForFile"]>()
          .mockRejectedValue(new Error("Unexpected token in eslint.config.js")),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ruleState({ file: fileA, ruleId: "cd/no-class" });

    expect(ruleState).toEqual({
      outcome: "failed",
      error: { kind: "team-config-unloadable", detail: "Unexpected token in eslint.config.js" },
    });
  });

  it("reports any other rejection while answering an ignore as team-config-unloadable", async () => {
    const ignoredState = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        isPathIgnored: vi
          .fn<EslintSurface["isPathIgnored"]>()
          .mockRejectedValue(new Error("Unexpected token in eslint.config.js")),
      }),
    })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toMatchObject({
      outcome: "failed",
      error: { kind: "team-config-unloadable" },
    });
  });

  it("reports ESLint failing to build as tool-failed", async () => {
    const ignoredState = await createEslintPort({ createEslint: throwsOnBuild })
      .createQueryInstance({ repoRoot })
      .ignoredState({ file: fileA });

    expect(ignoredState).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid Options: unknown option" },
    });
  });
});

describe("createGovernanceInstance", () => {
  it("builds ESLint on the runner's own complete configuration, never the team's", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await createEslintPort({ createEslint })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        ruleIds: ["cd/no-class"],
      })
      .lintFiles({ files: [fileA] });

    expect(createEslint).toHaveBeenCalledWith({
      options: {
        cwd: "/repo",
        overrideConfigFile: true,
        ignore: false,
        applySuppressions: false,
        allowInlineConfig: false,
        overrideConfig: expect.objectContaining({
          files: ["**/*.{ts,tsx,mts,cts}"],
          rules: { "cd/no-class": "error", "discipline-core/inline-config": "error" },
        }),
      },
    });
  });

  it("lints the requested files and returns ESLint's results", async () => {
    const lintFiles = vi.fn<EslintSurface["lintFiles"]>().mockResolvedValue([lintedA]);

    const linted = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, lintFiles }),
    })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        ruleIds: ["cd/no-class"],
      })
      .lintFiles({ files: [fileA, fileB] });

    expect([linted, lintFiles.mock.calls]).toEqual([
      { outcome: "ok", value: [lintedA] },
      [[{ filePaths: ["src/a.ts", "src/b.ts"] }]],
    ]);
  });

  it("reports a rejecting lint as tool-failed", async () => {
    const linted = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintFiles: vi
          .fn<EslintSurface["lintFiles"]>()
          .mockRejectedValue(new Error("visitor is not a function")),
      }),
    })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        ruleIds: ["cd/no-class"],
      })
      .lintFiles({ files: [fileA] });

    expect(linted).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "visitor is not a function" },
    });
  });

  it("reports ESLint failing to build as tool-failed", async () => {
    const linted = await createEslintPort({ createEslint: throwsOnBuild })
      .createGovernanceInstance({
        repoRoot,
        plugins: { cd: classAndFunctionPlugin },
        ruleIds: ["cd/no-class"],
      })
      .lintFiles({ files: [fileA] });

    expect(linted).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid Options: unknown option" },
    });
  });
});

describe("lintSourceCases", () => {
  it("lints each case's source as text under its file name", async () => {
    const lintText = vi.fn<EslintSurface["lintText"]>().mockResolvedValue([]);

    await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({ ...idleSurface, lintText }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase, noClassCase],
    });

    expect(lintText.mock.calls).toEqual([
      [{ code: "const a = 1;\nclass A {}\n", filePath: "cases/class.ts" }],
      [{ code: "const a = 1;\n", filePath: "cases/no-class.ts" }],
    ]);
  });

  it("builds ESLint on the governance configuration for the one requested rule, ignoring any configuration file", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await createEslintPort({ createEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(createEslint).toHaveBeenCalledWith({
      options: expect.objectContaining({
        overrideConfigFile: true,
        allowInlineConfig: false,
        overrideConfig: expect.objectContaining({
          plugins: expect.objectContaining({ cd: classAndFunctionPlugin }),
          rules: { "cd/no-class": "error", "discipline-core/inline-config": "error" },
        }),
      }),
    });
  });

  it("reports an inline-config-unreadable message as tool-failed", async () => {
    const verdicts = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/class.ts",
            messages: [
              {
                ruleId: "discipline-core/inline-config",
                messageId: "inline-config-unreadable",
                line: 1,
                column: 1,
                message: "inline configuration comments could not be read",
              },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "inline configuration comments could not be read in case class" },
    });
  });

  it("reports a case both inline-config-unreadable and holding a message with no rule as tool-failed", async () => {
    const verdicts = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/class.ts",
            messages: [
              { ruleId: null, line: 1, column: 7, message: "Parsing error: '{' expected.", fatal: true },
              {
                ruleId: "discipline-core/inline-config",
                messageId: "inline-config-unreadable",
                line: 1,
                column: 1,
                message: "inline configuration comments could not be read",
              },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "inline configuration comments could not be read in case class" },
    });
  });

  it("reports a case holding a fatal message as runner-invalid-output naming that case", async () => {
    const verdicts = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/class.ts",
            messages: [
              { ruleId: null, line: 1, column: 7, message: "Parsing error: '{' expected.", fatal: true },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail: "case class was not linted as a rule source: Parsing error: '{' expected.",
      },
    });
  });

  it("reports a case holding a message with no rule as runner-invalid-output naming that case", async () => {
    const verdicts = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi.fn<EslintSurface["lintText"]>().mockResolvedValue([
          {
            filePath: "/install/mechanisms/eslint/CD-14/cases/no-class.ts",
            messages: [
              {
                ruleId: null,
                line: 0,
                column: 0,
                message: "File ignored because no matching configuration was supplied.",
              },
              { ruleId: "cd/no-class", line: 1, column: 1, message: "no class" },
              { ruleId: null, line: 0, column: 0, message: "File ignored by default." },
            ],
          },
        ]),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [noClassCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: {
        kind: "runner-invalid-output",
        detail:
          "case no-class was not linted as a rule source: File ignored because no matching configuration was supplied.; File ignored by default.",
      },
    });
  });

  it("builds ESLint in the caller's working directory", async () => {
    const createEslint = vi.fn<CreateEslint>().mockReturnValue(idleSurface);

    await createEslintPort({ createEslint }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(createEslint).toHaveBeenCalledWith({
      options: expect.objectContaining({ cwd: "/install/mechanisms/eslint/CD-14" }),
    });
  });

  it("reports a rejecting lint as tool-failed", async () => {
    const verdicts = await createEslintPort({
      createEslint: vi.fn<CreateEslint>().mockReturnValue({
        ...idleSurface,
        lintText: vi
          .fn<EslintSurface["lintText"]>()
          .mockRejectedValue(new Error("visitor is not a function")),
      }),
    }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "visitor is not a function" },
    });
  });

  it("reports ESLint failing to build as tool-failed", async () => {
    const verdicts = await createEslintPort({ createEslint: throwsOnBuild }).lintSourceCases({
      cwd: conformanceRoot,
      plugin: classAndFunctionPlugin,
      pluginNamespace: "cd",
      rule: "no-class",
      cases: [classCase],
    });

    expect(verdicts).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "Invalid Options: unknown option" },
    });
  });
});
