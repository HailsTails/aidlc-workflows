import { defaultNativeRuleSources, type NativeRuleSources, typescriptEslintRules } from "../../runner/native-rules.ts";

export const createPlugin = (sources: NativeRuleSources) => ({
  meta: { name: "discipline-cd6", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["naming-convention"], sources }),
});

export default createPlugin(defaultNativeRuleSources);
