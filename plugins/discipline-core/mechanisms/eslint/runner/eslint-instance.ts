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
import { parseInlineConfigComment } from "./inline-config-parser.ts";

export const reservedNamespace = "discipline-core";

const INLINE_CONFIG_RULE = "inline-config";

const INLINE_CONFIG_RULE_ID = `${reservedNamespace}/${INLINE_CONFIG_RULE}`;

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

export type GovernanceBlock = {
  readonly files: readonly string[];
  readonly languageOptions: { readonly parser: unknown };
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin | InlineConfigPlugin>>;
  readonly rules: Readonly<Record<string, "error">>;
};

export type EslintSurfaceOptions = {
  readonly cwd?: AbsolutePath;
  readonly overrideConfigFile?: true;
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
  }) => QueryInstance;
  readonly createGovernanceInstance: (request: {
    readonly repoRoot: AbsolutePath;
    readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
    readonly ruleIds: readonly string[];
  }) => GovernanceInstance;
  readonly lintSourceCases: (request: {
    readonly cwd: AbsolutePath;
    readonly plugin: LoadedEslintPlugin;
    readonly pluginNamespace: string;
    readonly rule: string;
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

const inlineConfigMessageId = (request: {
  readonly text: string;
  readonly ruleIds: readonly string[];
}): InlineConfigMessageId | "not-reported" => {
  const parsed = parseInlineConfigComment({ text: request.text });
  switch (parsed.kind) {
    case "disable":
      return parsed.ruleIds.length === 0 ||
        parsed.ruleIds.some((ruleId) => request.ruleIds.includes(ruleId))
        ? "inline-disable"
        : "not-reported";
    case "rule-config":
      return parsed.ruleIds.some((ruleId) => request.ruleIds.includes(ruleId))
        ? "inline-rule-config"
        : "not-reported";
    case "unparseable-rule-config":
      return "inline-rule-config";
    case "not-an-exception":
      return "not-reported";
  }
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
        Program: (programNode) => {
          const configNodes = inlineConfigNodesSchema.safeParse(
            context.sourceCode.getInlineConfigNodes?.(),
          );
          if (!configNodes.success) {
            context.report({ node: programNode, messageId: INLINE_CONFIG_UNREADABLE });
            return;
          }
          configNodes.data.forEach((comment) => {
            const messageId = inlineConfigMessageId({
              text: comment.value,
              ruleIds: request.ruleIds,
            });
            if (messageId === "not-reported") {
              return;
            }
            context.report({ node: comment, messageId, data: { text: commentText({ comment }) } });
          });
        },
      }),
    },
  },
});

export const governanceConfig = (request: {
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
  readonly ruleIds: readonly string[];
}): GovernanceBlock => ({
  files: GOVERNED_FILES,
  languageOptions: { parser: typescriptParser },
  plugins: {
    ...request.plugins,
    [reservedNamespace]: inlineConfigPlugin({ ruleIds: request.ruleIds }),
  },
  rules: Object.fromEntries(
    [...request.ruleIds, INLINE_CONFIG_RULE_ID].map((ruleId): [string, "error"] => [ruleId, "error"]),
  ),
});

const governanceOptions = (request: {
  readonly cwd: AbsolutePath;
  readonly plugins: Readonly<Record<string, LoadedEslintPlugin>>;
  readonly ruleIds: readonly string[];
}): EslintSurfaceOptions => ({
  cwd: request.cwd,
  overrideConfigFile: true,
  ignore: false,
  applySuppressions: false,
  allowInlineConfig: false,
  overrideConfig: governanceConfig({ plugins: request.plugins, ruleIds: request.ruleIds }),
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

export const createEslintPort = (options: { readonly createEslint: CreateEslint }): EslintPort => {
  const built = (request: {
    readonly options: EslintSurfaceOptions;
  }): Promise<Result<EslintSurface, RunnerFailure>> =>
    Promise.resolve()
      .then(() => options.createEslint({ options: request.options }))
      .then((surface): Result<EslintSurface, RunnerFailure> => ({ outcome: "ok", value: surface }), toolFailed);

  const onSurface = <T>(request: {
    readonly surface: Promise<Result<EslintSurface, RunnerFailure>>;
    readonly act: (surface: EslintSurface) => Promise<T>;
    readonly onRejected: (thrown: unknown) => Result<never, RunnerFailure>;
  }): Promise<Result<T, RunnerFailure>> =>
    request.surface.then((builtSurface) => {
      if (builtSurface.outcome === "failed") {
        return builtSurface;
      }
      return Promise.resolve()
        .then(() => request.act(builtSurface.value))
        .then((acted): Result<T, RunnerFailure> => ({ outcome: "ok", value: acted }), request.onRejected);
    });

  return {
    createQueryInstance: (request) => {
      const surface = built({ options: { cwd: request.repoRoot } });
      return {
        ignoredState: (query) =>
          onSurface({
            surface,
            act: (eslint) =>
              eslint
                .isPathIgnored({ filePath: query.file })
                .then((ignored): IgnoredState => (ignored ? "ignored" : "checked")),
            onRejected: queryFailed,
          }),
        ruleState: (query) =>
          onSurface({
            surface,
            act: (eslint) => eslint.calculateConfigForFile({ filePath: query.file }),
            onRejected: queryFailed,
          }).then((resolved): Result<RuleState, RunnerFailure> => {
            if (resolved.outcome === "failed") {
              return resolved;
            }
            const parsed = resolvedConfigSchema.safeParse(resolved.value);
            if (!parsed.success) {
              return {
                outcome: "failed",
                error: { kind: "runner-invalid-output", detail: parsed.error.message },
              };
            }
            return { outcome: "ok", value: ruleStateOf({ resolved: parsed.data, ruleId: query.ruleId }) };
          }),
      };
    },
    createGovernanceInstance: (request) => {
      const surface = built({
        options: governanceOptions({
          cwd: request.repoRoot,
          plugins: request.plugins,
          ruleIds: request.ruleIds,
        }),
      });
      return {
        lintFiles: (lint) =>
          onSurface({
            surface,
            act: (eslint) => eslint.lintFiles({ filePaths: lint.files }),
            onRejected: toolFailed,
          }),
      };
    },
    lintSourceCases: (request) => {
      const ruleId = `${request.pluginNamespace}/${request.rule}`;
      return onSurface({
        surface: built({
          options: governanceOptions({
            cwd: request.cwd,
            plugins: { [request.pluginNamespace]: request.plugin },
            ruleIds: [ruleId],
          }),
        }),
        act: (eslint) =>
          Promise.all(
            request.cases.map((sourceCase) =>
              eslint
                .lintText({ code: sourceCase.source, filePath: sourceCase.fileName })
                .then((linted) => ({
                  caseName: sourceCase.name,
                  messages: linted.flatMap((file) => file.messages),
                })),
            ),
          ),
        onRejected: toolFailed,
      }).then((lintedCases): Result<readonly CaseVerdict[], RunnerFailure> => {
        if (lintedCases.outcome === "failed") {
          return lintedCases;
        }
        const unreadableCase = lintedCases.value.find((lintedCase) =>
          lintedCase.messages.some(
            (message) =>
              message.ruleId === INLINE_CONFIG_RULE_ID &&
              message.messageId === INLINE_CONFIG_UNREADABLE,
          ),
        );
        if (unreadableCase !== undefined) {
          return {
            outcome: "failed",
            error: {
              kind: "tool-failed",
              detail: `inline configuration comments could not be read in case ${unreadableCase.caseName}`,
            },
          };
        }
        return {
          outcome: "ok",
          value: lintedCases.value.map((lintedCase) => ({
            caseName: lintedCase.caseName,
            flaggedLines: lintedCase.messages
              .filter((message) => message.ruleId === ruleId)
              .map((message) => message.line),
          })),
        };
      });
    },
  };
};

const lintedFileOf = (lintResult: ESLint.LintResult): LintedFile => ({
  filePath: lintResult.filePath,
  messages: lintResult.messages.map(
    (message): LintedMessage => ({
      ruleId: message.ruleId,
      ...(message.messageId === undefined ? {} : { messageId: message.messageId }),
      line: message.line,
      column: message.column,
      message: message.message,
      ...(message.fatal === true ? { fatal: true } : {}),
    }),
  ),
});

export const defaultCreateEslint: CreateEslint = (request) => {
  const { overrideConfig, ...surfaceOptions } = request.options;
  const eslint = new ESLint(
    overrideConfig === undefined
      ? surfaceOptions
      : { ...surfaceOptions, overrideConfig: { ...overrideConfig, files: [...overrideConfig.files] } },
  );
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
