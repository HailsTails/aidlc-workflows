import * as typescriptParser from "@typescript-eslint/parser";
import { ESLint } from "eslint-9";
import { eslintPluginModuleSchema } from "../../../mechanisms/eslint/runner/eslint-plugin-schema.ts";
import type { EslintPieceSettings } from "../../../mechanisms/eslint/runner/eslint-piece-settings-schema.ts";

export const ESLINT_9_VERSION = ESLint.version;

export const linesFlaggedByPiece = async (request: {
  readonly pieceRoot: string;
  readonly settings: EslintPieceSettings;
  readonly fileName: string;
  readonly source: string;
}): Promise<readonly number[]> => {
  const { pluginNamespace, pluginModule, rule, options = [] } = request.settings;
  const piece = eslintPluginModuleSchema.parse(await import(`${request.pieceRoot}/${pluginModule}`));
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,mts,cts}"],
        languageOptions: { parser: typescriptParser },
        plugins: { [pluginNamespace]: piece.default },
        rules: { [`${pluginNamespace}/${rule}`]: ["error", ...options] },
      },
    ],
  });
  const [result] = await eslint.lintText(request.source, { filePath: `${process.cwd()}/${request.fileName}` });
  return [...new Set(result?.messages.map((message) => message.line))].sort();
};
