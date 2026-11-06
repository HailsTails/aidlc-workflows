import projection from "./disciplines.eslint.mjs";
import { createRequire } from "node:module";

const disciplineRequire = createRequire(new URL("./tools/discipline-core/package.json", import.meta.url));
const typescriptEslint = disciplineRequire("@typescript-eslint/eslint-plugin");
const { builtinRules } = disciplineRequire("eslint/use-at-your-own-risk");
const recommendedCoreRules = Object.fromEntries(
  [...builtinRules].filter(([name, rule]) => rule.meta.docs.recommended && name !== "no-undef").map(([name]) => [name, "error"]),
);

export default [
  { ignores: ["tools/**", ".baselines/**", "node_modules/**", "verification/**"] },
  ...typescriptEslint.configs["flat/recommended"],
  { files: ["**/*.{ts,tsx,mts,cts}"], rules: recommendedCoreRules },
  typescriptEslint.configs["flat/eslint-recommended"],
  ...projection,
  { files: ["**/*.{ts,tsx,mts,cts}"], rules: {
    "@typescript-eslint/no-non-null-assertion": "error",
    "no-var": "error",
    "prefer-const": "error",
    "no-eval": "error",
    "no-new-func": "error",
  } },
];
