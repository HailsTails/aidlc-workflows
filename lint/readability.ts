import type { Linter } from "eslint";

export type ReadabilitySlot = Linter.RulesRecord;

export const INTERIM_READABILITY: ReadabilitySlot = {
  "aidlc/no-comments": "error",
  "no-nested-ternary": "error",
  "max-len": ["error", { code: 100, ignoreUrls: true, ignoreRegExpLiterals: true }],
  "max-params": ["error", 3],
  "max-depth": ["error", 3],
  complexity: ["error", 8],
  "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
};

export const readabilityConfig = (slot: ReadabilitySlot): Linter.Config => ({
  name: "aidlc/readability",
  files: ["**/*.ts"],
  rules: slot,
});
