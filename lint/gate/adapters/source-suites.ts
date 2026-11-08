import { CONTEXTS } from "../../context-map.ts";
import { HARNESS_FOLDER_NAMES } from "../../harness-folders.ts";
import type { TestSuite } from "../application/tests-check.ts";

const folderSuite = (root: string): TestSuite => ({
  name: root,
  triggers: [`${root}/**`],
  tests: [`${root}/**/*.test.ts`],
});

export const SOURCE_SUITES: readonly TestSuite[] = [
  ...CONTEXTS.map((context) => folderSuite(`src/${context}`)),
  ...HARNESS_FOLDER_NAMES.map((harness) => folderSuite(`src/hosts/${harness}`)),
];
