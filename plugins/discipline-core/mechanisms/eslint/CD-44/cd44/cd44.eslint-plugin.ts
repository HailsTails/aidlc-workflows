import { defaultNativeRuleSources, eslintCoreRules, type NativeRuleSources } from "../../runner/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "discipline-cd44", version: "0.0.0-local" },
  rules: eslintCoreRules({ names: ["no-param-reassign"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
