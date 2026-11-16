import { defaultNativeRuleSources, type NativeRuleSources, typescriptEslintRules } from "../../runner/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "discipline-cd40", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["max-params"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
