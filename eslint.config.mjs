import * as typescriptParser from "@typescript-eslint/parser";
import disciplines from "./disciplines.eslint.mjs";

// Discipline rules supplement the whole-fork Biome gate; they do not replace it.
export default [
  {
    name: "workflow/typescript",
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: { parser: typescriptParser },
    linterOptions: { noInlineConfig: true },
  },
  ...disciplines,
];
