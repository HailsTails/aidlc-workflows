import typescriptEslint from "@typescript-eslint/eslint-plugin";
import { builtinRules } from "eslint/use-at-your-own-risk";

export type NativeRules = Readonly<Record<string, object>>;

export type NativeRuleSources = {
  readonly eslintCore: ReadonlyMap<string, object>;
  readonly typescriptEslint: NativeRules;
};

export type TypescriptEslintRuleName = keyof typeof typescriptEslint.rules;

export const defaultNativeRuleSources: NativeRuleSources = {
  eslintCore: builtinRules,
  typescriptEslint: typescriptEslint.rules,
};

const namedRules = (request: {
  readonly names: readonly string[];
  readonly ruleNamed: (name: string) => object | undefined;
}): NativeRules =>
  Object.fromEntries(
    request.names.flatMap((name): readonly (readonly [string, object])[] => {
      const rule = request.ruleNamed(name);
      return rule === undefined ? [] : [[name, rule]];
    }),
  );

export const eslintCoreRules = (request: {
  readonly names: readonly string[];
  readonly sources: NativeRuleSources;
}): NativeRules => namedRules({ names: request.names, ruleNamed: (name) => request.sources.eslintCore.get(name) });

export const typescriptEslintRules = (request: {
  readonly names: readonly TypescriptEslintRuleName[];
  readonly sources: NativeRuleSources;
}): NativeRules =>
  namedRules({
    names: request.names,
    ruleNamed: (name) => (Object.hasOwn(request.sources.typescriptEslint, name) ? request.sources.typescriptEslint[name] : undefined),
  });
