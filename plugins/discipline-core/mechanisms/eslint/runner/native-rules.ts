import typescriptEslint from "@typescript-eslint/eslint-plugin";
import { builtinRules } from "eslint/use-at-your-own-risk";

export type NativeRules = Readonly<Record<string, object>>;

export type TypescriptEslintRuleName = keyof typeof typescriptEslint.rules;

export const eslintCoreRules = (request: { readonly names: readonly string[] }): NativeRules =>
  Object.fromEntries(
    request.names.flatMap((name): readonly (readonly [string, object])[] => {
      const rule = builtinRules.get(name);
      return rule === undefined ? [] : [[name, rule]];
    }),
  );

export const typescriptEslintRules = (request: {
  readonly names: readonly TypescriptEslintRuleName[];
}): NativeRules => Object.fromEntries(request.names.map((name) => [name, typescriptEslint.rules[name]]));
