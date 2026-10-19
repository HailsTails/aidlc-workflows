import { typescriptEslintRules } from "../../runner/native-rules.ts";

export default {
  meta: { name: "discipline-cd40", version: "0.0.0-local" },
  rules: typescriptEslintRules({ names: ["max-params"] }),
};
