import { describe, expect, test } from "bun:test";
import type { GateScope } from "./gate-scope.ts";
import { lintCheck } from "./lint-check.ts";
import type { LintTargets, RatchetRecords } from "./ports.ts";

const records = {
  globs: [],
  monolithFiles: [],
  boundary: () => ({ "core/tools/aidlc-lib.ts": { "One owner": 17 } }),
  monolith: () => undefined,
  saveBoundary: () => undefined,
  saveMonoliths: () => undefined,
} satisfies RatchetRecords;

const scopeChanging = (...paths: string[]): GateScope =>
  ({
    everything: false,
    record: false,
    changes: paths.map((path) => ({ path, kind: "modified" })),
  }) as unknown as GateScope;

const targetsFor = async (scope: GateScope): Promise<LintTargets[]> => {
  const asked: LintTargets[] = [];
  await lintCheck({
    linter: {
      measure: async (targets) => {
        asked.push(targets);
        return { counts: {}, examples: {} };
      },
    },
    records,
    ruleInputs: ["lint/*.ts"],
    ownerInputs: ["src/glossary.json"],
  }).run(scope);
  return asked;
};

describe("lintCheck owner registry", () => {
  test("a scoped run that changes the glossary lints every file", async () => {
    expect(await targetsFor(scopeChanging("src/glossary.json"))).toEqual([{ kind: "all" }]);
  });

  test("a scoped run that leaves the glossary alone lints only its files", async () => {
    expect(await targetsFor(scopeChanging("src/projection/domain/x.ts"))).toEqual([
      { kind: "files", files: ["src/projection/domain/x.ts"] },
    ]);
  });
});
