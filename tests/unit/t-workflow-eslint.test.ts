import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const packageScripts = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).scripts;
const eslint = new ESLint({ cwd: fileURLToPath(new URL("../..", import.meta.url)) });

// These assertions test developer configuration, not shipped workflow behavior.
describe("workflow ESLint developer gate", () => {
  test("keeps the ordinary lint route conjunctive with the existing Biome gate", () => {
    expect(packageScripts.lint).toBe("bun run lint:workflow && bun run lint:biome");
    expect(packageScripts["lint:biome"]).toBe("biome check --error-on-warnings core harness scripts plugins tests");
    expect(packageScripts.check).toContain("bun run lint");
  });

  test("keeps all 25 prior paths and fifteen evidence, installed-boundary and runtime owners", () => {
    expect(packageScripts["lint:workflow"].split(" ").slice(0, 6)).toEqual([
      "node", "node_modules/eslint/bin/eslint.js", "--no-ignore", "--max-warnings", "0", "core/tools/aidlc-workflow-candidate.ts",
    ]);
    expect(packageScripts["lint:workflow"].split(" ").slice(5)).toEqual([
      "core/tools/aidlc-workflow-candidate.ts", "core/tools/aidlc-workflow-candidate-inputs.ts",
      "core/tools/aidlc-workflow-candidate.test.ts", "core/tools/aidlc-workflow-candidate-inputs.test.ts",
      "tests/unit/t-workflow-candidate.test.ts", "tests/integration/t-workflow-candidate-inputs.test.ts",
      "tests/integration/t-workflow-candidate-refresh.test.ts", "tests/harness/workflow-candidate-fixtures.ts",
      "tests/harness/workflow-candidate-fixtures.test.ts", "core/tools/aidlc-workflow-source-reader.ts",
      "core/tools/aidlc-workflow-source-reader.test.ts", "core/tools/aidlc-workflow-compatibility.test.ts",
      "core/tools/aidlc-runner-gen.ts", "core/tools/aidlc-runner-gen.test.ts", "core/tools/aidlc-runtime-paths.ts",
      "core/tools/aidlc-lib.ts", "core/tools/aidlc-utility.ts", "core/tools/aidlc-init.ts",
      "tests/unit/t-workflow-surfaces.test.ts", "tests/integration/t-workflow-surface-staging.test.ts",
      "tests/integration/t66.test.ts",
      "core/tools/aidlc-workflow-wire.ts", "core/tools/aidlc-workflow-wire.test.ts",
      "core/tools/aidlc-graph.ts", "tests/unit/t-workflow-eslint.test.ts",
      "core/workflow-evidence/presence/presence-evidence.ts",
      "core/workflow-evidence/presence/presence-evidence.test.ts",
      "core/workflow-evidence/presence/gate-presence.ts",
      "core/workflow-evidence/presence/gate-presence.test.ts",
      "core/workflow-evidence/answers/reply-reuse.ts",
      "core/workflow-evidence/answers/reply-reuse.test.ts",
      "core/workflow-evidence/answers/answer-availability.ts",
      "core/workflow-evidence/answers/answer-availability.test.ts",
      "core/workflow-evidence/adapters/runtime-presence.ts",
      "core/workflow-evidence/adapters/runtime-presence.test.ts",
      "tests/unit/t-workflow-evidence.test.ts",
      "tests/harness/workflow-evidence-installation.ts",
      "tests/integration/t-workflow-evidence-installed.test.ts",
      "core/tools/aidlc-log.ts",
      "core/tools/aidlc-state.ts",
    ]);
  });

});

describe("workflow ESLint projected rule enforcement", () => {
  test("reports actual selected-rule violations despite inline disable attempts", async () => {
    const results = await eslint.lintText("/* eslint-disable */\nlet result;\nexport const answer: any = result;\n", {
      filePath: "core/tools/aidlc-workflow-candidate.ts",
    });
    expect(results[0]?.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "discipline-cd1/implicit-any-let", severity: 2 }),
      expect.objectContaining({ ruleId: "discipline-cd1/no-explicit-any", severity: 2 }),
    ]));
  });

  test("accepts a literal clean control using the actual root projection", async () => {
    const results = await eslint.lintText("export const workflowName = 'candidate';\n", {
      filePath: "core/tools/aidlc-workflow-candidate.ts",
    });
    expect(results[0]?.messages).toEqual([]);
  });

  test("loads every projected rule as an error with no inline configuration", async () => {
    const config = await eslint.calculateConfigForFile("tests/integration/t66.test.ts");
    expect(config.linterOptions.noInlineConfig).toBe(true);
    expect(config.rules).toEqual(expect.objectContaining({
      "discipline/no-extraneous-class": [2, { allowConstructorOnly: true, allowEmpty: true, allowStaticOnly: false, allowWithDecorator: true }],
      "discipline-cd1/implicit-any-let": [2], "discipline-cd1/no-explicit-any": [2],
      "discipline-cd10/throw-only-error": [2], "discipline-cd27/focused-tests": [2],
      "discipline-cd27/skipped-tests": [2], "discipline-cd40/max-params": [2, { max: 2, countVoidThis: true }],
      "discipline-cd41/cognitive-complexity": [2], "discipline-cd41/function-length": [2],
      "discipline-cd42/useless-else": [2], "discipline-cd44/no-param-reassign": [2, { props: false }],
      "discipline-cd6/naming-convention": expect.arrayContaining([2]), "discipline-cd7/filename-case": [2],
    }));
  });
});
