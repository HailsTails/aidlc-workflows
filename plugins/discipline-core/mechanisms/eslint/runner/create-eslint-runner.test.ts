import { describe, expect, it, vi } from "vitest";
import type { ExceptionRecord } from "../../../core/exception-records/exception-records.ts";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { RunnerClause } from "../../../core/mechanism-port/runner-module-schema.ts";
import type { CaseVerdict } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { ModuleLoaderPort } from "../../../core/platform-ports/module-loader-port.ts";
import { createPathPort } from "../../../core/platform-ports/path-port.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { mechanismIdSchema } from "../../../core/values/identifiers.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import type { WhyChain } from "../../../core/values/why-chain.ts";
import { createEslintRunner, type EslintRunnerPorts } from "./create-eslint-runner.ts";
import type { RuleState } from "./eslint-config-schema.ts";
import type {
  EslintPort,
  GovernanceInstance,
  IgnoredState,
  LintedFile,
  LintedMessage,
  QueryInstance,
} from "./eslint-instance.ts";

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

type EslintFakeParts = {
  readonly query: QueryInstance;
  readonly lintFiles: GovernanceInstance["lintFiles"];
  readonly lintSourceCases: EslintPort["lintSourceCases"];
};

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/repo/node_modules/discipline-core");
const PIECE_ROOT = "/repo/node_modules/discipline-core/mechanisms/eslint/CD-14";
const LOOPS_PIECE_ROOT = "/repo/node_modules/discipline-core/mechanisms/eslint/CD-15";
const PLUGIN_MODULE_PATH = "/repo/node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";
const LOOPS_MODULE_PATH = "/repo/node_modules/discipline-core/mechanisms/eslint/CD-15/loops/loops.eslint-plugin.ts";
const PROJECTION_PATH = "/repo/disciplines.eslint.mjs";
const RULE_ID = "rin-discipline/no-class-authoring";
const LOOPS_RULE_ID = "rin-loops/no-for-of";

const ESLINT = mechanismIdSchema.parse("eslint");
const ESLINT_10 = mechanismIdSchema.parse("eslint-10");
const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");
const FOR_OF = clauseAddressSchema.parse("CD-15#for-of");
const CLASS_SYNTAX_OBJECT = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };
const FOR_OF_OBJECT = { ruleSet: "shared", discipline: "CD-15", clause: "for-of" };

const FILE_A = repoPathSchema.parse("src/a.ts");
const FACTORY = repoPathSchema.parse("src/factory.ts");
const FILES = [FILE_A, FACTORY];

const CLASS_SETTINGS = {
  pluginNamespace: "rin-discipline",
  pluginModule: "cd14/cd14.eslint-plugin.ts",
  rule: "no-class-authoring",
};

const CLASS_CLAUSE: RunnerClause = {
  address: CLASS_SYNTAX,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: PIECE_ROOT,
  settings: CLASS_SETTINGS,
};

const LOOPS_CLAUSE: RunnerClause = {
  address: FOR_OF,
  anchor: { kind: "keyword", keyword: "for" },
  pieceRoot: LOOPS_PIECE_ROOT,
  settings: { pluginNamespace: "rin-loops", pluginModule: "loops/loops.eslint-plugin.ts", rule: "no-for-of" },
};

const CLASS_PLUGIN_MODULE = {
  default: { rules: { "no-class-authoring": { meta: { type: "problem" }, create: () => ({}) } } },
};

const LOOPS_PLUGIN_MODULE = {
  default: { rules: { "no-for-of": { meta: { type: "problem" }, create: () => ({}) } } },
};

const PLUGIN_MODULES: Readonly<Record<string, unknown>> = {
  [PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE,
  [LOOPS_MODULE_PATH]: LOOPS_PLUGIN_MODULE,
};

const WHY = {
  why: "Why does this file declare a class?",
  because: "The vendored parser exports a class the adapter must extend",
  evidence: "vendor/parser/index.d.ts line 12",
};

const WHY_CHAIN: WhyChain = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "The vendored parser's extension point is class-based",
  owner: "260926-vendor-divergence-untrac",
};

const FACTORY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "the wrapping factory for the library",
};

const FACTORY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: FACTORY,
  reason: "Inherited class awaiting paydown",
  whyChain: WHY_CHAIN,
};

const FACTORY_LOCATION_UNDER_ESLINT_10: ExceptionRecord = { ...FACTORY_LOCATION, mechanism: ESLINT_10 };

const GONE_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  file: repoPathSchema.parse("src/gone.ts"),
  reason: "the wrapping factory for the library",
};

const CLAUSE_WIDE: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: ESLINT,
  reason: "Class syntax carved out during migration",
  whyChain: WHY_CHAIN,
};

const ENABLING_PROJECTION = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
];
`;

const FACTORY_LOCATION_PROJECTION = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/factory.ts",
    files: ["src/factory.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`;

const GONE_LOCATION_PROJECTION = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/authorised-location/CD-14#class-syntax/src/gone.ts",
    files: ["src/gone.ts"],
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`;

const CLAUSE_WIDE_PROJECTION = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
  {
    name: "discipline-core/clause-wide-carve-out/CD-14#class-syntax",
    rules: { "rin-discipline/no-class-authoring": "off" },
  },
];
`;

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: PROJECTION_PATH, detail: "ENOENT" } },
  presence: "absent",
};

const UNREADABLE_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: PROJECTION_PATH, detail: "EACCES" } },
  presence: "present",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined }),
});

const SOURCE_FILES: Readonly<Record<string, FakeFile>> = {
  "/repo/src/a.ts": presentFile({ text: "const a = 1;\n\n  class A {}\n" }),
  "/repo/src/factory.ts": presentFile({
    text: "const b = 1;\nconst c = 2;\nconst d = 3;\nconst e = 4;\n  xs.forEach(visit);\n",
  }),
};

const projectionHolding = (request: { readonly text: string }): FileTextPort =>
  fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: presentFile({ text: request.text }) });

const repoHolding = (request: {
  readonly projection: string;
  readonly files: Readonly<Record<string, FakeFile>>;
}): FileTextPort =>
  fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: presentFile({ text: request.projection }), ...request.files });

const modulesOver = (modules: Readonly<Record<string, unknown>>): ModuleLoaderPort => ({
  load: ({ path }) => Promise.resolve({ outcome: "ok", value: modules[path] }),
});

const UNLOADABLE_MODULES: ModuleLoaderPort = {
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({
    outcome: "failed",
    error: { kind: "module-unloadable", path: PLUGIN_MODULE_PATH, detail: "SyntaxError" },
  }),
};

const queryOver = (request: {
  readonly ignored: Readonly<Record<string, IgnoredState>>;
  readonly states: Readonly<Record<string, RuleState>>;
}): QueryInstance => ({
  ignoredState: ({ file }) => Promise.resolve({ outcome: "ok", value: request.ignored[file] }),
  ruleState: ({ file, ruleId }) => Promise.resolve({ outcome: "ok", value: request.states[`${file} ${ruleId}`] }),
});

const failingQuery = (failure: RunnerFailure): QueryInstance => ({
  ignoredState: () => Promise.resolve({ outcome: "failed", error: failure }),
  ruleState: () => Promise.resolve({ outcome: "failed", error: failure }),
});

const CHECKED: Readonly<Record<string, IgnoredState>> = { "src/a.ts": "checked", "src/factory.ts": "checked" };

const ERROR: RuleState = { state: "configured", severity: 2 };
const OFF: RuleState = { state: "configured", severity: 0 };
const ABSENT: RuleState = { state: "rule-absent" };
const IGNORED: RuleState = { state: "file-ignored" };

const IN_EFFECT_QUERY = queryOver({
  ignored: CHECKED,
  states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ERROR },
});

const linted = (request: { readonly messagesInA: readonly LintedMessage[] }): readonly LintedFile[] => [
  { filePath: "/repo/src/a.ts", messages: request.messagesInA },
  { filePath: "/repo/src/factory.ts", messages: [] },
];

const lintResolving = (outcome: Result<readonly LintedFile[], RunnerFailure>) =>
  vi.fn<GovernanceInstance["lintFiles"]>().mockResolvedValue(outcome);

const CLASS_MESSAGE: LintedMessage = { ruleId: RULE_ID, line: 3, column: 3, message: "class authored" };

const CLEAN_LINT = lintResolving({ outcome: "ok", value: linted({ messagesInA: [] }) });

const HIT_IN_A = {
  clause: CLASS_SYNTAX_OBJECT,
  file: "src/a.ts",
  anchor: { line: 3, column: 2 },
  snippet: "class A {}",
};

const eslintOver = (overrides: Partial<EslintFakeParts>): EslintPort => {
  const parts: EslintFakeParts = {
    query: IN_EFFECT_QUERY,
    lintFiles: CLEAN_LINT,
    lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue({ outcome: "ok", value: [] }),
    ...overrides,
  };
  return {
    createQueryInstance: vi.fn<EslintPort["createQueryInstance"]>().mockReturnValue(parts.query),
    createGovernanceInstance: vi.fn<EslintPort["createGovernanceInstance"]>().mockReturnValue({
      lintFiles: parts.lintFiles,
    }),
    lintSourceCases: parts.lintSourceCases,
  };
};

const runnerOver = (overrides: Partial<EslintRunnerPorts>) =>
  createEslintRunner({
    fileText: projectionHolding({ text: ENABLING_PROJECTION }),
    modules: modulesOver(PLUGIN_MODULES),
    path: createPathPort({ workingDirectory: () => "/elsewhere" }),
    eslint: eslintOver({}),
    ...overrides,
  });

const runRequest = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
}) => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  files: FILES,
  trackedPaths: FILES,
  clauses: request.clauses,
  records: request.records,
});

const CLASS_RUN = runRequest({ clauses: [CLASS_CLAUSE], records: [] });

const trackedRun = (request: { readonly tracked: string }) => ({
  ...CLASS_RUN,
  trackedPaths: [repoPathSchema.parse(request.tracked), FILE_A, FACTORY],
});

const TWO_CLAUSE_RUN = runRequest({ clauses: [CLASS_CLAUSE, LOOPS_CLAUSE], records: [] });

const TWO_RULES_IN_EFFECT = queryOver({
  ignored: CHECKED,
  states: {
    [`src/a.ts ${RULE_ID}`]: ERROR,
    [`src/factory.ts ${RULE_ID}`]: ERROR,
    [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
    [`src/factory.ts ${LOOPS_RULE_ID}`]: ERROR,
  },
});

const SHARED_FOR_OF_RULE_ID = "rin-discipline/no-for-of";

const SHARED_MODULE_FOR_OF_CLAUSE: RunnerClause = {
  address: FOR_OF,
  anchor: { kind: "keyword", keyword: "for" },
  pieceRoot: PIECE_ROOT,
  settings: { ...CLASS_SETTINGS, rule: "no-for-of" },
};

const SHARED_PLUGIN_MODULE = {
  default: {
    rules: {
      "no-class-authoring": { meta: { type: "problem" }, create: () => ({}) },
      "no-for-of": { meta: { type: "problem" }, create: () => ({}) },
    },
  },
};

const SHARED_MODULE_RUN = runRequest({ clauses: [CLASS_CLAUSE, SHARED_MODULE_FOR_OF_CLAUSE], records: [] });

const SHARED_MODULE_PROJECTION = `import piece0 from "./node_modules/discipline-core/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error", "rin-discipline/no-for-of": "error" },
  },
];
`;

const SHARED_MODULE_RULES_IN_EFFECT = queryOver({
  ignored: CHECKED,
  states: {
    [`src/a.ts ${RULE_ID}`]: ERROR,
    [`src/factory.ts ${RULE_ID}`]: ERROR,
    [`src/a.ts ${SHARED_FOR_OF_RULE_ID}`]: ERROR,
    [`src/factory.ts ${SHARED_FOR_OF_RULE_ID}`]: ERROR,
  },
});

const inlineMessageInA = (request: {
  readonly messageId: "inline-disable" | "inline-rule-config";
  readonly text: string;
}) =>
  lintResolving({
    outcome: "ok",
    value: linted({
      messagesInA: [
        { ruleId: "discipline-core/inline-config", messageId: request.messageId, line: 2, column: 1, message: request.text },
      ],
    }),
  });

const NOT_INCLUDED = { outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "not-included" } };

const CLASS_CASE: SourceCase = {
  name: "class",
  fileName: repoPathSchema.parse("cases/class.ts"),
  source: "class A {}\n",
  expectedLines: [1],
};

const CLASS_VERDICTS: Result<readonly CaseVerdict[], RunnerFailure> = {
  outcome: "ok",
  value: [{ caseName: "class", flaggedLines: [1] }],
};

describe("createEslintRunner", () => {
  it("declares config-override as the only kind its projection writes", () => {
    expect(runnerOver({}).projectedKinds).toEqual(["config-override"]);
  });
});

describe("the governance run, step 1: selected pieces", () => {
  it("loads the plugin module at the piece root joined with its pluginModule", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    await runnerOver({ modules: { load } }).run(CLASS_RUN);
    expect(load.mock.calls).toEqual([[{ path: PLUGIN_MODULE_PATH }]]);
  });

  it("is piece-invalid when two selected clauses share one rule id, building no ESLint instance", async () => {
    const eslint = eslintOver({});
    const report = await runnerOver({ eslint }).run(
      runRequest({ clauses: [CLASS_CLAUSE, { ...CLASS_CLAUSE, address: FOR_OF }], records: [] }),
    );
    expect({
      report,
      queryInstances: vi.mocked(eslint.createQueryInstance).mock.calls,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
    }).toEqual({
      report: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: expect.any(String), detail: expect.any(String) } },
      queryInstances: [],
      governanceInstances: [],
    });
  });

  it("is piece-invalid when two pieces map one plugin namespace to different plugin modules", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({
          clauses: [
            CLASS_CLAUSE,
            {
              ...LOOPS_CLAUSE,
              settings: { pluginNamespace: "rin-discipline", pluginModule: "loops/loops.eslint-plugin.ts", rule: "no-for-of" },
            },
          ],
          records: [],
        }),
      ),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "piece-invalid" } });
  });

  it("is piece-invalid for a piece registering under the reserved discipline-core namespace", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({
          clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, pluginNamespace: "discipline-core" } }],
          records: [],
        }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid naming the piece root for a pluginModule that leaves the piece folder", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({ clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, pluginModule: "../x.ts" } }], records: [] }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid naming the piece root when the plugin module cannot be loaded", async () => {
    await expect(runnerOver({ modules: UNLOADABLE_MODULES }).run(CLASS_RUN)).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid when the plugin module has no default export of rules", async () => {
    await expect(
      runnerOver({ modules: modulesOver({ [PLUGIN_MODULE_PATH]: { rules: {} } }) }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("is piece-invalid when the clause's rule is not a key of the plugin's rules", async () => {
    await expect(
      runnerOver({}).run(
        runRequest({ clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, rule: "no-classes" } }], records: [] }),
      ),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) },
    });
  });

  it("loads and parses a plugin module shared by two selected clauses once, selecting both clauses", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: SHARED_PLUGIN_MODULE });
    const report = await runnerOver({
      fileText: projectionHolding({ text: SHARED_MODULE_PROJECTION }),
      modules: { load },
      eslint: eslintOver({
        query: SHARED_MODULE_RULES_IN_EFFECT,
        lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }),
      }),
    }).run(SHARED_MODULE_RUN);
    expect({ loads: load.mock.calls, report }).toEqual({
      loads: [[{ path: PLUGIN_MODULE_PATH }]],
      report: { outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [], projection: "current" } },
    });
  });

  it("is piece-invalid naming the piece root of the clause whose rule a shared plugin module lacks", async () => {
    await expect(
      runnerOver({ modules: modulesOver({ [PLUGIN_MODULE_PATH]: CLASS_PLUGIN_MODULE }) }).run(SHARED_MODULE_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "the plugin has no rule named no-for-of" },
    });
  });
});

describe("the governance run, step 2: the projection's presence and bytes", () => {
  it("is missing with no hits and no native exceptions when disciplines.eslint.mjs is absent, building no ESLint instance", async () => {
    const eslint = eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }) });
    const report = await runnerOver({ fileText: fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: ABSENT_FILE }), eslint }).run(CLASS_RUN);
    expect({
      report,
      queryInstances: vi.mocked(eslint.createQueryInstance).mock.calls,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
    }).toEqual({
      report: { outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "missing" } },
      queryInstances: [],
      governanceInstances: [],
    });
  });

  it("is out-of-date for a hand-edited projection and still reports the run's hits", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: `// hand edited\n${ENABLING_PROJECTION}` }),
        eslint: eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [], projection: "out-of-date" } });
  });

  it("is out-of-date when the projection lacks the block of a record the run was given", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "out-of-date" } });
  });

  it("is file-unreadable at disciplines.eslint.mjs when the projection exists but cannot be read", async () => {
    await expect(
      runnerOver({ fileText: fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: UNREADABLE_FILE }) }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: expect.any(String) },
    });
  });
});

describe("the governance run, step 3: the projection in effect", () => {
  it("builds the query instance on the repository root", async () => {
    const eslint = eslintOver({});
    await runnerOver({ eslint }).run(CLASS_RUN);
    expect(vi.mocked(eslint.createQueryInstance).mock.calls).toEqual([[{ repoRoot: "/repo" }]]);
  });

  it("passes team-config-unloadable through from the query instance", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({ query: failingQuery({ kind: "team-config-unloadable", detail: "eslint.config.mjs threw" }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" } });
  });

  it("passes plugin-conflict through from the query instance", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({ query: failingQuery({ kind: "plugin-conflict", detail: 'Cannot redefine plugin "rin-discipline"' }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "plugin-conflict", detail: 'Cannot redefine plugin "rin-discipline"' },
    });
  });

  it("passes runner-invalid-output through for a resolved configuration the query refuses", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({ query: failingQuery({ kind: "runner-invalid-output", detail: "rules: expected array" }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "runner-invalid-output", detail: "rules: expected array" } });
  });

  it("is not-included with no hits and no native exceptions when the selected rule is absent on every checked file", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ABSENT, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
          lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction one with the selected rule at severity 0 everywhere and no records", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("holds direction one when the selected rule is configured on one checked file only", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included when the selected rule is configured only where every file is ignored or the rule absent", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "ignored", "src/factory.ts": "checked" },
            states: { [`src/a.ts ${RULE_ID}`]: IGNORED, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction one when every file is ignored", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "ignored", "src/factory.ts": "ignored" },
            states: { [`src/a.ts ${RULE_ID}`]: IGNORED, [`src/factory.ts ${RULE_ID}`]: IGNORED },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included when a later team block sets an authorised location's file back to error", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction two when the authorised location's file is at severity 0", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included when a file carve-out's file is not at severity 0", async () => {
    await expect(
      runnerOver({}).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_CARVE_OUT] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds direction two for a clause-wide carve-out at severity 0 on every checked file", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: CLAUSE_WIDE_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [CLAUSE_WIDE] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("is not-included for a clause-wide carve-out when one checked file is at severity 2", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: CLAUSE_WIDE_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: OFF, [`src/factory.ts ${RULE_ID}`]: ERROR },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [CLAUSE_WIDE] })),
    ).resolves.toEqual(NOT_INCLUDED);
  });

  it("holds the projection current for an authorised location recorded under another mechanism id the runner is registered under", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION_UNDER_ESLINT_10] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("does not check a record whose file is not among the files under check", async () => {
    await expect(
      runnerOver({ fileText: projectionHolding({ text: GONE_LOCATION_PROJECTION }) }).run(
        runRequest({ clauses: [CLASS_CLAUSE], records: [GONE_LOCATION] }),
      ),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });

  it("does not check a record whose file is ignored", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "checked", "src/factory.ts": "ignored" },
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: IGNORED },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toMatchObject({ outcome: "ok", value: { projection: "current" } });
  });
});

describe("the governance run, step 4: the governance instance", () => {
  it("builds one governance instance on the repository root with the parsed plugin under its namespace and the selected rule ids", async () => {
    const eslint = eslintOver({});
    await runnerOver({ eslint }).run(CLASS_RUN);
    expect(vi.mocked(eslint.createGovernanceInstance).mock.calls).toEqual([
      [
        {
          repoRoot: "/repo",
          plugins: {
            "rin-discipline": expect.objectContaining({
              rules: expect.objectContaining({ "no-class-authoring": expect.anything() }),
            }),
          },
          ruleIds: [RULE_ID],
        },
      ],
    ]);
  });

  it("lints every path in files once", async () => {
    const lintFiles = lintResolving({ outcome: "ok", value: linted({ messagesInA: [] }) });
    await runnerOver({ eslint: eslintOver({ lintFiles }) }).run(CLASS_RUN);
    expect(lintFiles.mock.calls).toEqual([[{ files: ["src/a.ts", "src/factory.ts"] }]]);
  });

  it("passes tool-failed through from the lint", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({ outcome: "failed", error: { kind: "tool-failed", detail: "visitor is not a function" } }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "tool-failed", detail: "visitor is not a function" } });
  });
});

describe("the governance run, step 5: messages", () => {
  it("reports a selected rule's message as a hit on the file's repo path at its line and column minus one", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [], projection: "current" } });
  });

  it("maps each message back to its clause by rule id across two pieces", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: {
              [`src/a.ts ${RULE_ID}`]: ERROR,
              [`src/factory.ts ${RULE_ID}`]: ERROR,
              [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
              [`src/factory.ts ${LOOPS_RULE_ID}`]: ERROR,
            },
          }),
          lintFiles: lintResolving({
            outcome: "ok",
            value: [
              { filePath: "/repo/src/a.ts", messages: [CLASS_MESSAGE] },
              {
                filePath: "/repo/src/factory.ts",
                messages: [{ ruleId: LOOPS_RULE_ID, line: 5, column: 1, message: "for-of loop" }],
              },
            ],
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE, LOOPS_CLAUSE], records: [] })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [
          HIT_IN_A,
          { clause: FOR_OF_OBJECT, file: "src/factory.ts", anchor: { line: 5, column: 0 }, snippet: "xs.forEach(visit);" },
        ],
        nativeExceptions: [],
        projection: "out-of-date",
      },
    });
  });

  it("reports no hit for a message of a rule no clause selected", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({ messagesInA: [{ ruleId: "no-console", line: 2, column: 1, message: "console" }] }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
  });

  it("is file-unparseable for a file ESLint could not parse", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [{ ruleId: null, line: 1, column: 7, message: "Parsing error: '{' expected.", fatal: true }],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/a.ts", detail: expect.stringContaining("Parsing error") },
    });
  });

  it("reports an inline-disable message as an inline-disable native exception for the clause", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "discipline-core/inline-config",
                  messageId: "inline-disable",
                  line: 4,
                  column: 1,
                  message: "// eslint-disable-next-line rin-discipline/no-class-authoring",
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 4,
            text: "// eslint-disable-next-line rin-discipline/no-class-authoring",
          },
        ],
        projection: "current",
      },
    });
  });

  it("reports an inline-rule-config message as an inline-rule-config native exception for the clause", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "discipline-core/inline-config",
                  messageId: "inline-rule-config",
                  line: 1,
                  column: 1,
                  message: '/* eslint rin-discipline/no-class-authoring: "off" */',
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 1,
            text: '/* eslint rin-discipline/no-class-authoring: "off" */',
          },
        ],
        projection: "current",
      },
    });
  });

  it("is tool-failed naming the file for an inline-config-unreadable message", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "discipline-core/inline-config",
                  messageId: "inline-config-unreadable",
                  line: 1,
                  column: 1,
                  message: "inline configuration comments could not be read",
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("src/a.ts") },
    });
  });
});

describe("conform", () => {
  it("lints the cases in the piece root with the piece's parsed plugin, namespace and rule, and returns their verdicts", async () => {
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: CLASS_CLAUSE,
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: CLASS_VERDICTS,
      lints: [
        [
          expect.objectContaining({
            cwd: PIECE_ROOT,
            plugin: expect.objectContaining({ rules: expect.objectContaining({ "no-class-authoring": expect.anything() }) }),
            pluginNamespace: "rin-discipline",
            rule: "no-class-authoring",
            cases: [CLASS_CASE],
          }),
        ],
      ],
    });
  });

  it("passes runner-invalid-output naming a case through from the case lint", async () => {
    const failure: Result<readonly CaseVerdict[], RunnerFailure> = {
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: "case class: Parsing error: '{' expected." },
    };
    await expect(
      runnerOver({
        eslint: eslintOver({ lintSourceCases: vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(failure) }),
      }).conform({ clause: CLASS_CLAUSE, cases: [CLASS_CASE] }),
    ).resolves.toEqual(failure);
  });

  it("is piece-invalid without linting when the plugin module cannot be loaded", async () => {
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ modules: UNLOADABLE_MODULES, eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: CLASS_CLAUSE,
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) } },
      lints: [],
    });
  });

  it("is piece-invalid without linting when the clause's rule is not in the plugin", async () => {
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: { ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, rule: "no-classes" } },
      cases: [CLASS_CASE],
    });
    expect({ verdicts, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) } },
      lints: [],
    });
  });
});

describe("project", () => {
  it("writes the off block of an authorised location recorded under another mechanism id the runner is registered under", async () => {
    const fileText = fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: ABSENT_FILE });
    await runnerOver({ fileText }).project({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      clauses: [CLASS_CLAUSE],
      records: [FACTORY_LOCATION_UNDER_ESLINT_10],
    });
    expect(vi.mocked(fileText.write).mock.calls).toEqual([
      [{ path: PROJECTION_PATH, text: FACTORY_LOCATION_PROJECTION }],
    ]);
  });

  it("writes the projection generated from the clauses and records to disciplines.eslint.mjs at the repository root", async () => {
    const fileText = fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: ABSENT_FILE });
    const write = await runnerOver({ fileText }).project({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      clauses: [CLASS_CLAUSE],
      records: [FACTORY_LOCATION],
    });
    expect({ write, fileWrites: vi.mocked(fileText.write).mock.calls }).toEqual({
      write: { outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "written" } },
      fileWrites: [[{ path: PROJECTION_PATH, text: FACTORY_LOCATION_PROJECTION }]],
    });
  });
});


describe("the governance run, step 5: hit snippets", () => {
  it("is file-unreadable at a hit's file when its source cannot be read for the snippet", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/src/a.ts": {
              read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" } },
              presence: "present",
            },
          },
        }),
        eslint: eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }) }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "src/a.ts", detail: expect.any(String) },
    });
  });

  it("reports the findings' failure, not the tracked exceptions', when both fail", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/src/a.ts": {
              read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" } },
              presence: "present",
            },
            "/repo/package.json": {
              read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/package.json", detail: "EPERM" } },
              presence: "present",
            },
          },
        }),
        eslint: eslintOver({ lintFiles: lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) }) }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "src/a.ts", detail: "EACCES" },
    });
  });
});

describe("native exceptions: ignores and configuration overrides over files", () => {
  it("reports an ignored file as one ignore per selected clause", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "checked", "src/factory.ts": "ignored" },
            states: {
              [`src/a.ts ${RULE_ID}`]: ERROR,
              [`src/factory.ts ${RULE_ID}`]: IGNORED,
              [`src/a.ts ${LOOPS_RULE_ID}`]: ERROR,
              [`src/factory.ts ${LOOPS_RULE_ID}`]: IGNORED,
            },
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
          { kind: "ignore", clause: FOR_OF_OBJECT, file: "src/factory.ts" },
        ],
        projection: "out-of-date",
      },
    });
  });

  it("reports a checked file where the selected rule is absent as a config-override", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: ABSENT },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" }],
        projection: "current",
      },
    });
  });

  it("reports a checked file where the selected rule is a warning as a config-override", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: { state: "configured", severity: 1 } },
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" }],
        projection: "current",
      },
    });
  });

  it("reports the projected off on a recorded file as a config-override, leaving recording to governance", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: FACTORY_LOCATION_PROJECTION }),
        eslint: eslintOver({
          query: queryOver({
            ignored: CHECKED,
            states: { [`src/a.ts ${RULE_ID}`]: ERROR, [`src/factory.ts ${RULE_ID}`]: OFF },
          }),
        }),
      }).run(runRequest({ clauses: [CLASS_CLAUSE], records: [FACTORY_LOCATION] })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" }],
        projection: "current",
      },
    });
  });
});

describe("native exceptions: suppression files over tracked paths", () => {
  it("reports an entry for a selected rule in the root eslint-suppressions.json", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/eslint-suppressions.json": presentFile({
              text: JSON.stringify({ "src/a.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
            }),
          },
        }),
      }).run(trackedRun({ tracked: "eslint-suppressions.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "suppression-entry", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", location: "eslint-suppressions.json" },
        ],
        projection: "current",
      },
    });
  });

  it("resolves a nested eslint-suppressions.json's keys against its own directory", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/packages/a/eslint-suppressions.json": presentFile({
              text: JSON.stringify({ "src/x.ts": { "rin-discipline/no-class-authoring": { count: 2 } } }),
            }),
          },
        }),
      }).run(trackedRun({ tracked: "packages/a/eslint-suppressions.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX_OBJECT,
            file: "packages/a/src/x.ts",
            location: "packages/a/eslint-suppressions.json",
          },
        ],
        projection: "current",
      },
    });
  });

  it("passes tool-failed through for a malformed eslint-suppressions.json", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: { "/repo/eslint-suppressions.json": presentFile({ text: "{" }) },
        }),
      }).run(trackedRun({ tracked: "eslint-suppressions.json" })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });
});

describe("native exceptions: package.json scripts over tracked paths", () => {
  it("reports a dormant --rule in a lint script as a command-line-option at the declaring package.json", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/package.json": presentFile({
              text: JSON.stringify({ scripts: { lint: "eslint --rule 'rin-discipline/no-class-authoring: off' src" } }),
            }),
          },
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX_OBJECT,
            location: "package.json",
            script: "lint",
            option: "--rule rin-discipline/no-class-authoring: off",
          },
        ],
        projection: "current",
      },
    });
  });

  it("reads a script's --suppressions-location file and reports its entries at that location", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/package.json": presentFile({
              text: JSON.stringify({ scripts: { lint: "eslint --suppressions-location ci/lint-suppressions.json src" } }),
            }),
            "/repo/ci/lint-suppressions.json": presentFile({
              text: JSON.stringify({ "src/a.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
            }),
          },
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            location: "ci/lint-suppressions.json",
          },
        ],
        projection: "current",
      },
    });
  });

  it("resolves a nested package.json's suppressions location and its keys against that package's directory", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/packages/a/package.json": presentFile({
              text: JSON.stringify({ scripts: { lint: "eslint --suppressions-location=ci/s.json src" } }),
            }),
            "/repo/packages/a/ci/s.json": presentFile({
              text: JSON.stringify({ "src/x.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
            }),
          },
        }),
      }).run(trackedRun({ tracked: "packages/a/package.json" })),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "suppression-entry",
            clause: CLASS_SYNTAX_OBJECT,
            file: "packages/a/src/x.ts",
            location: "packages/a/ci/s.json",
          },
        ],
        projection: "current",
      },
    });
  });

  it("passes tool-failed through for a script with an unterminated quote", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: { "/repo/package.json": presentFile({ text: JSON.stringify({ scripts: { lint: "eslint 'src" } }) }) },
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toMatchObject({ outcome: "failed", error: { kind: "tool-failed", detail: expect.stringContaining("lint") } });
  });

  it("is file-unreadable at a tracked package.json that cannot be read", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/package.json": {
              read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/package.json", detail: "EACCES" } },
              presence: "present",
            },
          },
        }),
      }).run(trackedRun({ tracked: "package.json" })),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "package.json", detail: expect.any(String) },
    });
  });

  it("reads no tracked path whose name only ends in package.json", async () => {
    await expect(
      runnerOver({}).run(trackedRun({ tracked: "docs/my-package.json" })),
    ).resolves.toEqual({ outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } });
  });
});

describe("native exceptions: inline directives with several selected clauses", () => {
  it("reports a disable naming one selected rule for that rule's clause only", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "// eslint-disable-next-line rin-discipline/no-class-authoring",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "// eslint-disable-next-line rin-discipline/no-class-authoring",
          },
        ],
        projection: "out-of-date",
      },
    });
  });

  it("reports a disable naming both selected rules once for each clause", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-disable",
            text: "/* eslint-disable rin-discipline/no-class-authoring, rin-loops/no-for-of */",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-disable",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable rin-discipline/no-class-authoring, rin-loops/no-for-of */",
          },
          {
            kind: "inline-disable",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint-disable rin-discipline/no-class-authoring, rin-loops/no-for-of */",
          },
        ],
        projection: "out-of-date",
      },
    });
  });

  it("reports a disable naming no rule once for every selected clause", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({ messageId: "inline-disable", text: "/* eslint-disable */" }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "inline-disable", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", line: 2, text: "/* eslint-disable */" },
          { kind: "inline-disable", clause: FOR_OF_OBJECT, file: "src/a.ts", line: 2, text: "/* eslint-disable */" },
        ],
        projection: "out-of-date",
      },
    });
  });

  it("reports a rule configuration naming one selected rule for that rule's clause only", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({ messageId: "inline-rule-config", text: '/* eslint rin-loops/no-for-of: "off" */' }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: '/* eslint rin-loops/no-for-of: "off" */',
          },
        ],
        projection: "out-of-date",
      },
    });
  });
});

describe("the governance run, settled message handling", () => {
  it("is tool-failed for a linted file outside the repository root", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({ outcome: "ok", value: [{ filePath: "/elsewhere/src/a.ts", messages: [CLASS_MESSAGE] }] }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("/elsewhere/src/a.ts") },
    });
  });

  it("checks a file's fatal message before reading the source for its hits", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/src/a.ts": {
              read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/src/a.ts", detail: "EACCES" } },
              presence: "present",
            },
          },
        }),
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                CLASS_MESSAGE,
                { ruleId: null, line: 1, column: 7, message: "Parsing error: '{' expected.", fatal: true },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/a.ts", detail: "Parsing error: '{' expected." },
    });
  });

  it("reports the first fatal file in lint order", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: [
              {
                filePath: "/repo/src/factory.ts",
                messages: [{ ruleId: null, line: 2, column: 1, message: "Parsing error: factory", fatal: true }],
              },
              {
                filePath: "/repo/src/a.ts",
                messages: [{ ruleId: null, line: 1, column: 1, message: "Parsing error: a", fatal: true }],
              },
            ],
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "file-unparseable", file: "src/factory.ts", detail: "Parsing error: factory" },
    });
  });

  it("attributes an unparseable inline rule configuration to every selected clause", async () => {
    await expect(
      runnerOver({
        fileText: projectionHolding({ text: "export default [];\n" }),
        eslint: eslintOver({
          query: TWO_RULES_IN_EFFECT,
          lintFiles: inlineMessageInA({
            messageId: "inline-rule-config",
            text: "/* eslint rin-discipline/no-class-authoring: [ */",
          }),
        }),
      }).run(TWO_CLAUSE_RUN),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          {
            kind: "inline-rule-config",
            clause: CLASS_SYNTAX_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint rin-discipline/no-class-authoring: [ */",
          },
          {
            kind: "inline-rule-config",
            clause: FOR_OF_OBJECT,
            file: "src/a.ts",
            line: 2,
            text: "/* eslint rin-discipline/no-class-authoring: [ */",
          },
        ],
        projection: "out-of-date",
      },
    });
  });

  it("is tool-failed naming the file for an inline-config message of an unknown message id", async () => {
    await expect(
      runnerOver({
        eslint: eslintOver({
          lintFiles: lintResolving({
            outcome: "ok",
            value: linted({
              messagesInA: [
                {
                  ruleId: "discipline-core/inline-config",
                  messageId: "inline-enable",
                  line: 1,
                  column: 1,
                  message: "/* eslint-enable */",
                },
              ],
            }),
          }),
        }),
      }).run(CLASS_RUN),
    ).resolves.toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: expect.stringContaining("src/a.ts") },
    });
  });

  it("orders native exceptions as ignores, overrides, inline directives, suppression entries, then script options", async () => {
    await expect(
      runnerOver({
        fileText: repoHolding({
          projection: ENABLING_PROJECTION,
          files: {
            "/repo/package.json": presentFile({
              text: JSON.stringify({ scripts: { lint: "eslint --rule 'rin-discipline/no-class-authoring: off' src" } }),
            }),
            "/repo/eslint-suppressions.json": presentFile({
              text: JSON.stringify({ "src/a.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
            }),
          },
        }),
        eslint: eslintOver({
          query: queryOver({
            ignored: { "src/a.ts": "checked", "src/factory.ts": "ignored" },
            states: { [`src/a.ts ${RULE_ID}`]: { state: "configured", severity: 1 }, [`src/factory.ts ${RULE_ID}`]: IGNORED },
          }),
          lintFiles: inlineMessageInA({ messageId: "inline-disable", text: "/* eslint-disable */" }),
        }),
      }).run({
        ...CLASS_RUN,
        trackedPaths: [repoPathSchema.parse("package.json"), repoPathSchema.parse("eslint-suppressions.json"), FILE_A, FACTORY],
      }),
    ).resolves.toEqual({
      outcome: "ok",
      value: {
        hits: [],
        nativeExceptions: [
          { kind: "ignore", clause: CLASS_SYNTAX_OBJECT, file: "src/factory.ts" },
          { kind: "config-override", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts" },
          { kind: "inline-disable", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", line: 2, text: "/* eslint-disable */" },
          { kind: "suppression-entry", clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", location: "eslint-suppressions.json" },
          {
            kind: "command-line-option",
            clause: CLASS_SYNTAX_OBJECT,
            location: "package.json",
            script: "lint",
            option: "--rule rin-discipline/no-class-authoring: off",
          },
        ],
        projection: "current",
      },
    });
  });
});

describe("project, settled refusals", () => {
  it("is piece-invalid for invalid settings without loading a plugin or writing", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    const fileText = fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: ABSENT_FILE });
    const write = await runnerOver({ fileText, modules: { load } }).project({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      clauses: [{ ...CLASS_CLAUSE, settings: { ...CLASS_SETTINGS, pluginModule: "../x.ts" } }],
      records: [],
    });
    expect({ write, loads: load.mock.calls, fileWrites: vi.mocked(fileText.write).mock.calls }).toEqual({
      write: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) } },
      loads: [],
      fileWrites: [],
    });
  });

  it("is piece-invalid for two clauses sharing one rule id without loading a plugin or writing", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    const fileText = fileTextOver({ ...SOURCE_FILES, [PROJECTION_PATH]: ABSENT_FILE });
    const write = await runnerOver({ fileText, modules: { load } }).project({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      clauses: [CLASS_CLAUSE, { ...CLASS_CLAUSE, address: FOR_OF }],
      records: [],
    });
    expect({ write, loads: load.mock.calls, fileWrites: vi.mocked(fileText.write).mock.calls }).toEqual({
      write: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: expect.any(String) } },
      loads: [],
      fileWrites: [],
    });
  });
});

describe("conform, settled refusals", () => {
  it("is piece-invalid without loading or linting for a piece root that is not absolute", async () => {
    const load = vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: CLASS_PLUGIN_MODULE });
    const lintSourceCases = vi.fn<EslintPort["lintSourceCases"]>().mockResolvedValue(CLASS_VERDICTS);
    const verdicts = await runnerOver({ modules: { load }, eslint: eslintOver({ lintSourceCases }) }).conform({
      clause: { ...CLASS_CLAUSE, pieceRoot: "mechanisms/eslint/CD-14" },
      cases: [CLASS_CASE],
    });
    expect({ verdicts, loads: load.mock.calls, lints: lintSourceCases.mock.calls }).toEqual({
      verdicts: {
        outcome: "failed",
        error: { kind: "piece-invalid", pieceRoot: "mechanisms/eslint/CD-14", detail: expect.any(String) },
      },
      loads: [],
      lints: [],
    });
  });
});

describe("the governance run with nothing to lint", () => {
  it("skips the governance lint when no TypeScript file is under check, still scanning tracked paths", async () => {
    const lintFiles = lintResolving({
      outcome: "failed",
      error: { kind: "tool-failed", detail: 'No files matching the pattern "." were found.' },
    });
    const eslint = eslintOver({ lintFiles });
    const report = await runnerOver({
      fileText: repoHolding({
        projection: ENABLING_PROJECTION,
        files: {
          "/repo/package.json": presentFile({
            text: JSON.stringify({ scripts: { lint: "eslint --rule 'rin-discipline/no-class-authoring: off' src" } }),
          }),
        },
      }),
      eslint,
    }).run({ ...CLASS_RUN, files: [], trackedPaths: [repoPathSchema.parse("package.json")] });
    expect({
      report,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
      lints: lintFiles.mock.calls,
    }).toEqual({
      report: {
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX_OBJECT,
              location: "package.json",
              script: "lint",
              option: "--rule rin-discipline/no-class-authoring: off",
            },
          ],
          projection: "current",
        },
      },
      governanceInstances: [],
      lints: [],
    });
  });

  it("skips the governance lint when no clause is selected", async () => {
    const lintFiles = lintResolving({ outcome: "ok", value: linted({ messagesInA: [CLASS_MESSAGE] }) });
    const eslint = eslintOver({ lintFiles });
    const report = await runnerOver({ fileText: projectionHolding({ text: "\n\nexport default [\n\n];\n" }), eslint }).run(
      runRequest({ clauses: [], records: [] }),
    );
    expect({
      report,
      governanceInstances: vi.mocked(eslint.createGovernanceInstance).mock.calls,
      lints: lintFiles.mock.calls,
    }).toEqual({
      report: { outcome: "ok", value: { hits: [], nativeExceptions: [], projection: "current" } },
      governanceInstances: [],
      lints: [],
    });
  });
});
