import { presentPaths } from "../domain/change.ts";
import { globMatcher } from "../domain/glob.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { Command, CommandRunner, Workspace } from "./ports.ts";

export type TestSuite = {
  readonly name: string;
  readonly triggers: readonly string[];
  readonly tests: readonly string[];
};

export type TestsDependencies = {
  readonly runner: CommandRunner;
  readonly workspace: Workspace;
  readonly suites: readonly TestSuite[];
  readonly looseTests: readonly string[];
  readonly testCommand: (files: readonly string[]) => Command;
};

type Run = { readonly name: string; readonly files: readonly string[] };

const suiteRuns = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] => {
  const { workspace } = dependencies;
  return dependencies.suites
    .filter((suite) => scope.everything || touches(scope, suite.triggers))
    .map((suite) => ({ name: suite.name, files: workspace.filesMatching(suite.tests) }))
    .filter((run) => run.files.length > 0);
};

const looseRun = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] => {
  const files = presentPaths(scope.changes).filter(globMatcher(dependencies.looseTests));
  return scope.everything || files.length === 0 ? [] : [{ name: "changed tests", files }];
};

const failures = (dependencies: TestsDependencies, run: Run): readonly Finding[] => {
  const result = dependencies.runner.capture(dependencies.testCommand(run.files));
  const summary = result.output.split(/\r?\n/).filter((line) => /^\s*\d+ fail/.test(line));
  return result.exitCode === 0
    ? []
    : [
        {
          subject: run.name,
          violation: `bun test failed (${summary.join(" ").trim() || `exit ${result.exitCode}`})`,
          fix:
            `Run bun test ${run.files.join(" ")} and fix the code or the failing test; ` +
            "never skip, loosen or delete a test to get green.",
        },
      ];
};

export const testsCheck = (dependencies: TestsDependencies): GateCheck => ({
  id: "tests",
  run: async (scope) => {
    const runs = [...suiteRuns(dependencies, scope), ...looseRun(dependencies, scope)];
    if (runs.length === 0) {
      return skipped("tests", "no changed context has tests");
    }
    const findings = runs.flatMap((run) => failures(dependencies, run));
    const note = runs.map((run) => `${run.name} (${run.files.length})`).join(", ");
    return judged({ id: "tests", findings, note });
  },
});
