import * as typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint-9";
import { builtinRules } from "eslint-9/use-at-your-own-risk";
import { z } from "zod";
import type { SourceCase } from "../../../core/rule-set-reader/rule-set-reader.ts";
import { eslintPieceSettingsSchema } from "../../../mechanisms/eslint/runner/eslint-piece-settings-schema.ts";
import { type LoadedEslintPlugin, eslintPluginModuleSchema } from "../../../mechanisms/eslint/runner/eslint-plugin-schema.ts";
import { defaultNativeRuleSources, type NativeRuleSources } from "../../../mechanisms/eslint/runner/native-rules.ts";
import type { ConformanceRow } from "../../conformance-rows.ts";

export const ESLINT_9_VERSION = ESLint.version;

export type CaseMismatch = {
  readonly name: string;
  readonly expectedLines: readonly number[];
  readonly flaggedLines: readonly number[];
};

const ESLINT_9_SOURCES: NativeRuleSources = { ...defaultNativeRuleSources, eslintCore: builtinRules };

const nativeRulePieceSchema = z.object({
  createPlugin: z.function({ input: [z.custom<NativeRuleSources>((value) => value === ESLINT_9_SOURCES)], output: z.unknown() }),
});

const distinctSorted = (lines: readonly number[]): readonly number[] => [...new Set(lines)].sort((left, right) => left - right);

const pluginUnderEslint9 = async (request: { readonly modulePath: string }): Promise<LoadedEslintPlugin> => {
  const pieceModule: unknown = await import(request.modulePath);
  const injected = nativeRulePieceSchema.safeParse(pieceModule);
  return eslintPluginModuleSchema.parse(
    injected.success ? { default: injected.data.createPlugin(ESLINT_9_SOURCES) } : pieceModule,
  ).default;
};

const linesFlagged = async (request: {
  readonly eslint: ESLint;
  readonly sourceCase: SourceCase;
}): Promise<readonly number[]> => {
  const [lintResult] = await request.eslint.lintText(request.sourceCase.source, {
    filePath: `${process.cwd()}/${request.sourceCase.fileName}`,
  });
  return distinctSorted(lintResult?.messages.map((message) => message.line) ?? []);
};

const sameLines = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((line, index) => line === right[index]);

export const eslint9CaseMismatches = async (request: { readonly row: ConformanceRow }): Promise<readonly CaseMismatch[]> => {
  const { pluginNamespace, pluginModule, rule, options = [] } = eslintPieceSettingsSchema.parse(request.row.clause.settings);
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,mts,cts}"],
        languageOptions: { parser: typescriptParser },
        plugins: { [pluginNamespace]: await pluginUnderEslint9({ modulePath: `${request.row.clause.pieceRoot}/${pluginModule}` }) },
        rules: { [`${pluginNamespace}/${rule}`]: ["error", ...options] },
      },
    ],
  });
  const outcomes = await Promise.all(
    request.row.cases.map(async (sourceCase) => ({
      name: sourceCase.name,
      expectedLines: distinctSorted(sourceCase.expectedLines),
      flaggedLines: await linesFlagged({ eslint, sourceCase }),
    })),
  );
  return outcomes.filter((outcome) => !sameLines(outcome.expectedLines, outcome.flaggedLines));
};
