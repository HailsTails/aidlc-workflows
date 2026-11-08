import type { Linter } from "./eslint-port.ts";
import { CLEAN_TYPESCRIPT, SCAFFOLDING_TYPESCRIPT } from "./zones.ts";

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

export const interimReadabilityConfig = (slot: ReadabilitySlot): Linter.Config[] => [
  {
    name: "aidlc/readability/debt",
    files: ["**/*.ts"],
    ignores: [...CLEAN_TYPESCRIPT],
    rules: slot,
  },
  {
    name: "aidlc/readability/scaffolding",
    files: [...SCAFFOLDING_TYPESCRIPT],
    rules: slot,
  },
];

const EVERY_TYPESCRIPT_FILE = "**/*.{ts,tsx,mts,cts}";

const cleanFilesOf = (block: Linter.Config): Pick<Linter.Config, "files"> =>
  block.files?.length === 1 && block.files[0] === EVERY_TYPESCRIPT_FILE
    ? { files: [...CLEAN_TYPESCRIPT] }
    : {};

export const cleanZoneConfig = (disciplines: readonly Linter.Config[]): Linter.Config[] =>
  disciplines.map((block) => ({
    ...block,
    ...cleanFilesOf(block),
    ignores: [...SCAFFOLDING_TYPESCRIPT],
  }));
