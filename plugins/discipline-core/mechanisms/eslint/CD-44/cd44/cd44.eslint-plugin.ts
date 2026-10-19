import { eslintCoreRules } from "../../runner/native-rules.ts";

export default {
  meta: { name: "discipline-cd44", version: "0.0.0-local" },
  rules: eslintCoreRules({ names: ["no-param-reassign"] }),
};
