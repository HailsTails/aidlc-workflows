import tsParser from "@typescript-eslint/parser";
import type { Linter } from "./eslint-port.ts";
import tseslint from "typescript-eslint";
import {
  BIOME_RELAXED_NON_NULL,
  BIOME_RELAXED_TEMPLATE,
  BIOME_SUCCESSOR_RULES,
} from "./biome-successor.ts";
import { noComments } from "./no-comments.ts";
import { nodeImportProtocol } from "./node-import-protocol.ts";

const IGNORED = [
  "node_modules/**",
  "dist/**",
  "dist-release/**",
  "tests/logs/**",
  "tests/fixtures/v05-mr9-sensor-fire/failing-linter/**",
  "tests/fixtures/markdown-goldens/**",
];

export const standardsConfig: Linter.Config[] = [
  { name: "aidlc/ignores", ignores: IGNORED },
  {
    name: "aidlc/parser",
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, sourceType: "module" },
    plugins: {
      aidlc: { rules: { "no-comments": noComments, "node-import-protocol": nodeImportProtocol } },
      "@typescript-eslint": tseslint.plugin,
    },
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    name: "aidlc/standards",
    files: ["**/*.ts"],
    rules: BIOME_SUCCESSOR_RULES,
  },
  {
    name: "aidlc/standards/legacy-non-null",
    files: BIOME_RELAXED_NON_NULL,
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    name: "aidlc/standards/legacy-template",
    files: BIOME_RELAXED_TEMPLATE,
    rules: { "prefer-template": "off" },
  },
];
