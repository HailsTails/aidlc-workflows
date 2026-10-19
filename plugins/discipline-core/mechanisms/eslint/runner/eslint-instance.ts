import { z } from "zod";
import * as typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { CaseVerdict } from "../../../core/mechanism-port/runner-result-schema.ts";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { RepoPath } from "../../../core/values/repo-path.ts";
import type { Result } from "../../../core/values/result.ts";
import { type RuleState, resolvedConfigSchema, ruleStateOf } from "./eslint-config-schema.ts";
import {
  type InlineConfigNode,
  inlineConfigNodesSchema,
  type LoadedEslintPlugin,
} from "./eslint-plugin-schema.ts";
import type { RuleOptions } from "./eslint-piece-settings-schema.ts";
import { parseInlineConfigComment } from "./inline-config-parser.ts";

export type { AST, Rule, SourceCode } from "eslint";

export const reservedNamespace = "discipline-core";

const INLINE_CONFIG_RULE = "inline-config";

export const INLINE_CONFIG_RULE_ID = `${reservedNamespace}/${INLINE_CONFIG_RULE}`;

const GOVERNED_FILES: readonly string[] = ["**/*.{ts,tsx,mts,cts}"];

const PLUGIN_REDEFINITION_MESSAGE = "Cannot redefine plugin";

type InlineConfigMessageId = "inline-disable" | "inline-rule-config";

const INLINE_CONFIG_UNREADABLE = "inline-config-unreadable";

type InlineConfigContext = {
  readonly sourceCode: { readonly getInlineConfigNodes?: () => readonly unknown[] };
  readonly report: (
    descriptor:
      | {
          readonly node: unknown;
          readonly messageId: InlineConfigMessageId;
          readonly data: { readonly text: string };
        }
      | { readonly node: unknown; readonly messageId: typeof INLINE_CONFIG_UNREADABLE },
  ) => void;
};

type InlineConfigPlugin = {
  readonly rules: {
    readonly [INLINE_CONFIG_RULE]: {
      readonly meta: {
        readonly type: "problem";
        readonly schema: readonly [];
        readonly messages: Readonly<
          Record<InlineConfigMessageId | typeof INLINE_CONFIG_UNREADABLE, string>
        >;
      };
      readonly create: (context: InlineConfigContext) => {
        readonly Program: (programNode?: unknown) => void;
      };
    };
  };
};

export type GovernedRule = {
  readonly ruleId: string;
  readonly options: RuleOptions;
};

export type EnabledRuleEntry = "error" | readonly ["error", ...RuleOptions];

export type GovernanceBlock = {
  readonly files: readonly string[];
  readonly languageOptions: { readonly parser: unknown };
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin | InlineConfigPlugin>>;
  readonly rules: Readonly<Record<string, EnabledRuleEntry>>;
};

export type EslintSurfaceOptions = {
  readonly cwd?: AbsolutePath;
  readonly overrideConfigFile?: true | string;
  readonly ignore?: false;
  readonly applySuppressions?: false;
  readonly allowInlineConfig?: false;
  readonly overrideConfig?: GovernanceBlock;
};

export type LintedMessage = {
  readonly ruleId: string | null;
  readonly messageId?: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly fatal?: true;
};

export type LintedFile = {
  readonly filePath: string;
  readonly messages: readonly LintedMessage[];
};

export type EslintSurface = {
  readonly isPathIgnored: (request: { readonly filePath: string }) => Promise<boolean>;
  readonly calculateConfigForFile: (request: { readonly filePath: string }) => Promise<unknown>;
  readonly lintFiles: (request: {
    readonly filePaths: readonly string[];
  }) => Promise<readonly LintedFile[]>;
  readonly lintText: (request: {
    readonly code: string;
    readonly filePath: string;
  }) => Promise<readonly LintedFile[]>;
};

export type CreateEslint = (request: { readonly options: EslintSurfaceOptions }) => EslintSurface;

export type IgnoredState = "ignored" | "checked";

export type QueryInstance = {
  readonly ignoredState: (request: {
    readonly file: RepoPath;
  }) => Promise<Result<IgnoredState, RunnerFailure>>;
  readonly ruleState: (request: {
    readonly file: RepoPath;
    readonly ruleId: string;
  }) => Promise<Result<RuleState, RunnerFailure>>;
};

export type GovernanceInstance = {
  readonly lintFiles: (request: {
    readonly files: readonly RepoPath[];
  }) => Promise<Result<readonly LintedFile[], RunnerFailure>>;
};

export type EslintPort = {
  readonly createQueryInstance: (request: {
    readonly repoRoot: AbsolutePath;
    readonly configFile?: string;
  }) => QueryInstance;
  readonly createGovernanceInstance: (request: {
    readonly repoRoot: AbsolutePath;
    readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
    readonly rules: readonly GovernedRule[];
  }) => GovernanceInstance;
  readonly lintSourceCases: (request: {
    readonly cwd: AbsolutePath;
    readonly plugin: LoadedEslintPlugin;
    readonly pluginNamespace: string;
    readonly rule: string;
    readonly options: RuleOptions;
    readonly cases: readonly SourceCase[];
  }) => Promise<Result<readonly CaseVerdict[], RunnerFailure>>;
};

const commentText = (request: { readonly comment: InlineConfigNode }): string => {
  switch (request.comment.type) {
    case "Line":
      return `//${request.comment.value}`.trim();
    case "Block":
      return `/*${request.comment.value}*/`.trim();
  }
};

const selectionReach = (request: {
  readonly named: readonly string[];
  readonly ruleIds: readonly string[];
}): "names-selected-rule" | "names-no-selected-rule" =>
  request.named.some((ruleId) => request.ruleIds.includes(ruleId))
    ? "names-selected-rule"
    : "names-no-selected-rule";

const inlineConfigMessageId = (request: {
  readonly text: string;
  readonly ruleIds: readonly string[];
}): InlineConfigMessageId | "not-reported" => {
  const parsed = parseInlineConfigComment({ text: request.text });
  switch (parsed.kind) {
    case "disable": {
      if (
        parsed.ruleIds.length > 0 &&
        selectionReach({ named: parsed.ruleIds, ruleIds: request.ruleIds }) === "names-no-selected-rule"
      ) {
        return "not-reported";
      }
      return "inline-disable";
    }
    case "rule-config": {
      if (selectionReach({ named: parsed.ruleIds, ruleIds: request.ruleIds }) === "names-no-selected-rule") {
        return "not-reported";
      }
      return "inline-rule-config";
    }
    case "unparseable-rule-config":
      return "inline-rule-config";
    case "not-an-exception":
      return "not-reported";
  }
};

const reportedComment = (request: {
  readonly context: InlineConfigContext;
  readonly comment: InlineConfigNode;
  readonly ruleIds: readonly string[];
}): void => {
  const messageId = inlineConfigMessageId({ text: request.comment.value, ruleIds: request.ruleIds });
  if (messageId === "not-reported") {
    return;
  }
  request.context.report({
    node: request.comment,
    messageId,
    data: { text: commentText({ comment: request.comment }) },
  });
};

const reportedProgram = (request: {
  readonly context: InlineConfigContext;
  readonly programNode: unknown;
  readonly ruleIds: readonly string[];
}): void => {
  const configNodes = inlineConfigNodesSchema.safeParse(request.context.sourceCode.getInlineConfigNodes?.());
  if (!configNodes.success) {
    request.context.report({ node: request.programNode, messageId: INLINE_CONFIG_UNREADABLE });
    return;
  }
  configNodes.data.forEach((comment) => {
    reportedComment({ context: request.context, comment, ruleIds: request.ruleIds });
  });
};

const inlineConfigPlugin = (request: { readonly ruleIds: readonly string[] }): InlineConfigPlugin => ({
  rules: {
    [INLINE_CONFIG_RULE]: {
      meta: {
        type: "problem",
        schema: [],
        messages: {
          "inline-disable": "{{text}}",
          "inline-rule-config": "{{text}}",
          [INLINE_CONFIG_UNREADABLE]: "inline configuration comments could not be read",
        },
      },
      create: (context) => ({
        Program: (programNode) => reportedProgram({ context, programNode, ruleIds: request.ruleIds }),
      }),
    },
  },
});

export const enabledRuleEntry = (request: { readonly options: RuleOptions }): EnabledRuleEntry =>
  request.options.length === 0 ? "error" : ["error", ...request.options];

export const governanceConfig = (request: {
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
  readonly rules: readonly GovernedRule[];
}): GovernanceBlock => ({
  files: GOVERNED_FILES,
  languageOptions: { parser: typescriptParser },
  plugins: {
    ...request.plugins,
    [reservedNamespace]: inlineConfigPlugin({ ruleIds: request.rules.map((governed) => governed.ruleId) }),
  },
  rules: Object.fromEntries(
    [...request.rules, { ruleId: INLINE_CONFIG_RULE_ID, options: [] }].map(
      (governed): [string, EnabledRuleEntry] => [governed.ruleId, enabledRuleEntry({ options: governed.options })],
    ),
  ),
});

const governanceOptions = (request: {
  readonly cwd: AbsolutePath;
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
  readonly rules: readonly GovernedRule[];
}): EslintSurfaceOptions => ({
  cwd: request.cwd,
  overrideConfigFile: true,
  ignore: false,
  applySuppressions: false,
  allowInlineConfig: false,
  overrideConfig: governanceConfig({ plugins: request.plugins, rules: request.rules }),
});

const thrownDetail = (thrown: unknown): string =>
  thrown instanceof Error ? thrown.message : String(thrown);

const toolFailed = (thrown: unknown): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: thrownDetail(thrown) },
});

const queryFailed = (thrown: unknown): Result<never, RunnerFailure> => {
  const detail = thrownDetail(thrown);
  return {
    outcome: "failed",
    error: detail.includes(PLUGIN_REDEFINITION_MESSAGE)
      ? { kind: "plugin-conflict", detail }
      : { kind: "team-config-unloadable", detail },
  };
};

type LintedCase = {
  readonly caseName: string;
  readonly messages: readonly LintedMessage[];
};

const builtSurface = (request: {
  readonly createEslint: CreateEslint;
  readonly options: EslintSurfaceOptions;
}): Promise<Result<EslintSurface, RunnerFailure>> =>
  Promise.resolve()
    .then(() => request.createEslint({ options: request.options }))
    .then((surface): Result<EslintSurface, RunnerFailure> => ({ outcome: "ok", value: surface }), toolFailed);

const actedOn = <T>(request: {
  readonly surface: EslintSurface;
  readonly act: (surface: EslintSurface) => Promise<T>;
  readonly onRejected: (thrown: unknown) => Result<never, RunnerFailure>;
}): Promise<Result<T, RunnerFailure>> =>
  Promise.resolve()
    .then(() => request.act(request.surface))
    .then((acted): Result<T, RunnerFailure> => ({ outcome: "ok", value: acted }), request.onRejected);

const onSurface = <T>(request: {
  readonly surface: Promise<Result<EslintSurface, RunnerFailure>>;
  readonly act: (surface: EslintSurface) => Promise<T>;
  readonly onRejected: (thrown: unknown) => Result<never, RunnerFailure>;
}): Promise<Result<T, RunnerFailure>> =>
  request.surface.then((built) =>
    built.outcome === "failed"
      ? built
      : actedOn({ surface: built.value, act: request.act, onRejected: request.onRejected }),
  );

const ignoredStateOf = (request: { readonly eslint: EslintSurface; readonly file: RepoPath }): Promise<IgnoredState> =>
  request.eslint
    .isPathIgnored({ filePath: request.file })
    .then((ignored): IgnoredState => (ignored ? "ignored" : "checked"));

const resolvedRuleState = (request: {
  readonly resolved: Result<unknown, RunnerFailure>;
  readonly ruleId: string;
}): Result<RuleState, RunnerFailure> => {
  if (request.resolved.outcome === "failed") {
    return request.resolved;
  }
  const parsed = resolvedConfigSchema.safeParse(request.resolved.value);
  if (!parsed.success) {
    return {
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: z.prettifyError(parsed.error) },
    };
  }
  return { outcome: "ok", value: ruleStateOf({ resolved: parsed.data, ruleId: request.ruleId }) };
};

const queryInstanceOf = (request: {
  readonly surface: Promise<Result<EslintSurface, RunnerFailure>>;
}): QueryInstance => ({
  ignoredState: (query) =>
    onSurface({
      surface: request.surface,
      act: (eslint) => ignoredStateOf({ eslint, file: query.file }),
      onRejected: queryFailed,
    }),
  ruleState: (query) =>
    onSurface({
      surface: request.surface,
      act: (eslint) => eslint.calculateConfigForFile({ filePath: query.file }),
      onRejected: queryFailed,
    }).then((resolved) => resolvedRuleState({ resolved, ruleId: query.ruleId })),
});

const lintedCaseOf = (request: {
  readonly eslint: EslintSurface;
  readonly sourceCase: SourceCase;
}): Promise<LintedCase> =>
  request.eslint
    .lintText({ code: request.sourceCase.source, filePath: request.sourceCase.fileName })
    .then((linted) => ({
      caseName: request.sourceCase.name,
      messages: linted.flatMap((file) => file.messages),
    }));

const lintedCasesOf = (request: {
  readonly eslint: EslintSurface;
  readonly cases: readonly SourceCase[];
}): Promise<readonly LintedCase[]> =>
  Promise.all(request.cases.map((sourceCase) => lintedCaseOf({ eslint: request.eslint, sourceCase })));

const unreadableCaseOf = (request: { readonly lintedCases: readonly LintedCase[] }): LintedCase | undefined =>
  request.lintedCases.find((lintedCase) =>
    lintedCase.messages.some(
      (message) => message.ruleId === INLINE_CONFIG_RULE_ID && message.messageId === INLINE_CONFIG_UNREADABLE,
    ),
  );

const ruleLessCaseOf = (request: { readonly lintedCases: readonly LintedCase[] }): LintedCase | undefined =>
  request.lintedCases.find((lintedCase) => lintedCase.messages.some((message) => message.ruleId === null));

const ruleLessDetail = (request: { readonly lintedCase: LintedCase }): string =>
  `case ${request.lintedCase.caseName} was not linted as a rule source: ${request.lintedCase.messages
    .filter((message) => message.ruleId === null)
    .map((message) => message.message)
    .join("; ")}`;

const caseVerdictOf = (request: { readonly lintedCase: LintedCase; readonly ruleId: string }): CaseVerdict => ({
  caseName: request.lintedCase.caseName,
  flaggedLines: request.lintedCase.messages
    .filter((message) => message.ruleId === request.ruleId)
    .map((message) => message.line),
});

const caseVerdicts = (request: {
  readonly lintedCases: Result<readonly LintedCase[], RunnerFailure>;
  readonly ruleId: string;
}): Result<readonly CaseVerdict[], RunnerFailure> => {
  if (request.lintedCases.outcome === "failed") {
    return request.lintedCases;
  }
  const lintedCases = request.lintedCases.value;
  const unreadableCase = unreadableCaseOf({ lintedCases });
  if (unreadableCase !== undefined) {
    return {
      outcome: "failed",
      error: {
        kind: "tool-failed",
        detail: `inline configuration comments could not be read in case ${unreadableCase.caseName}`,
      },
    };
  }
  const ruleLessCase = ruleLessCaseOf({ lintedCases });
  if (ruleLessCase !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "runner-invalid-output", detail: ruleLessDetail({ lintedCase: ruleLessCase }) },
    };
  }
  return {
    outcome: "ok",
    value: lintedCases.map((lintedCase) => caseVerdictOf({ lintedCase, ruleId: request.ruleId })),
  };
};

const sourceCaseVerdicts = (request: {
  readonly createEslint: CreateEslint;
  readonly cwd: AbsolutePath;
  readonly plugin: LoadedEslintPlugin;
  readonly pluginNamespace: string;
  readonly rule: string;
  readonly options: RuleOptions;
  readonly cases: readonly SourceCase[];
}): Promise<Result<readonly CaseVerdict[], RunnerFailure>> => {
  const ruleId = `${request.pluginNamespace}/${request.rule}`;
  return onSurface({
    surface: builtSurface({
      createEslint: request.createEslint,
      options: governanceOptions({
        cwd: request.cwd,
        plugins: { [request.pluginNamespace]: request.plugin },
        rules: [{ ruleId, options: request.options }],
      }),
    }),
    act: (eslint) => lintedCasesOf({ eslint, cases: request.cases }),
    onRejected: toolFailed,
  }).then((lintedCases) => caseVerdicts({ lintedCases, ruleId }));
};

export const createEslintPort = (options: { readonly createEslint: CreateEslint }): EslintPort => ({
  createQueryInstance: (request) =>
    queryInstanceOf({
      surface: builtSurface({
        createEslint: options.createEslint,
        options:
          request.configFile === undefined
            ? { cwd: request.repoRoot }
            : { cwd: request.repoRoot, overrideConfigFile: request.configFile },
      }),
    }),
  createGovernanceInstance: (request) => {
    const surface = builtSurface({
      createEslint: options.createEslint,
      options: governanceOptions({ cwd: request.repoRoot, plugins: request.plugins, rules: request.rules }),
    });
    return {
      lintFiles: (lint) =>
        onSurface({ surface, act: (eslint) => eslint.lintFiles({ filePaths: lint.files }), onRejected: toolFailed }),
    };
  },
  lintSourceCases: (request) => sourceCaseVerdicts({ ...request, createEslint: options.createEslint }),
});

const lintedMessageOf = (message: ESLint.LintResult["messages"][number]): LintedMessage => ({
  ruleId: message.ruleId,
  ...(message.messageId === undefined ? {} : { messageId: message.messageId }),
  line: message.line,
  column: message.column,
  message: message.message,
  ...(message.fatal === true ? { fatal: true } : {}),
});

const lintedFileOf = (lintResult: ESLint.LintResult): LintedFile => ({
  filePath: lintResult.filePath,
  messages: lintResult.messages.map(lintedMessageOf),
});

const eslintOptionsOf = (request: { readonly options: EslintSurfaceOptions }): ESLint.Options => {
  const { overrideConfig, ...surfaceOptions } = request.options;
  if (overrideConfig === undefined) {
    return surfaceOptions;
  }
  return {
    ...surfaceOptions,
    overrideConfig: {
      ...overrideConfig,
      files: [...overrideConfig.files],
      rules: Object.fromEntries(
        Object.entries(overrideConfig.rules).map(([ruleId, entry]) => [
          ruleId,
          typeof entry === "string" ? entry : [...entry],
        ]),
      ),
    },
  };
};

export const defaultCreateEslint: CreateEslint = (request) => {
  const eslint = new ESLint(eslintOptionsOf({ options: request.options }));
  return {
    isPathIgnored: (query) => eslint.isPathIgnored(query.filePath),
    calculateConfigForFile: (query) => eslint.calculateConfigForFile(query.filePath),
    lintFiles: (lint) =>
      eslint.lintFiles([...lint.filePaths]).then((results) => results.map(lintedFileOf)),
    lintText: (lint) =>
      eslint
        .lintText(lint.code, { filePath: lint.filePath })
        .then((results) => results.map(lintedFileOf)),
  };
};

export const createDefaultEslintPort = (_options: Record<string, never>): EslintPort =>
  createEslintPort({ createEslint: defaultCreateEslint });
