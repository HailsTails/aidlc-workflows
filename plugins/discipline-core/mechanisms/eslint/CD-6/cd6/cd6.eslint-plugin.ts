import { typescriptEslintRules } from "../../runner/native-rules.ts";

export default {
  meta: { name: "discipline-cd6", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["naming-convention"] }),
};
