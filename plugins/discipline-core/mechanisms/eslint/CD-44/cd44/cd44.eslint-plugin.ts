import { defaultEslintBuiltinRules, type EslintBuiltinRules, eslintCoreRules } from "../../runner/native-rules.ts";

export const createPlugin = (dependencies: { readonly builtinRules: EslintBuiltinRules }) => ({
  meta: { name: "discipline-cd44", version: "0.0.0-local" },
  rules: eslintCoreRules({ names: ["no-param-reassign"], builtinRules: dependencies.builtinRules }),
});

export default createPlugin({ builtinRules: defaultEslintBuiltinRules });
