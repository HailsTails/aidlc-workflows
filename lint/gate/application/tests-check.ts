import { presentPaths } from "../domain/change.ts";
import {
  classifyFailures,
  excludedNote,
  failedCases,
  type CapabilityExclusion,
  type CapabilityId,
  type Probes,
} from "../domain/capability-exclusion.ts";
import { globMatcher } from "../domain/glob.ts";
import { importsAnyOf } from "../domain/legacy-selection.ts";
import { judged, skipped, type Finding } from "../domain/outcome.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { Capabilities, Command, CommandRunner, Workspace } from "./ports.ts";

export type TestSuite = {
  readonly name: string;
  readonly triggers: readonly string[];
  readonly tests: readonly string[];
  readonly following?: readonly string[];
  readonly command?: (files: readonly string[]) => Command;
};

export type TestsDependencies = {
  readonly runner: CommandRunner;
  readonly workspace: Workspace;
  readonly suites: readonly TestSuite[];
  readonly looseTests: readonly string[];
  readonly testCommand: (files: readonly string[]) => Command;
  readonly capabilities: Capabilities;
  readonly exclusions: readonly CapabilityExclusion[];
};

type Run = {
  readonly name: string;
  readonly files: readonly string[];
  readonly command: Command;
};

type RunVerdict = {
  readonly findings: readonly Finding[];
  readonly excluded: string;
};

const CAPABILITIES: readonly CapabilityId[] = ["symlinks", "short-names", "listable-system-temp"];

const follows = (text: string, modules: readonly string[]): boolean =>
  importsAnyOf({ text, modules });

const selectedFiles = (dependencies: TestsDependencies, suite: TestSuite): readonly string[] => {
  const { workspace } = dependencies;
  const files = workspace.filesMatching(suite.tests);
  const { following } = suite;
  return following === undefined
    ? files
    : files.filter((file) => follows(workspace.read(file) ?? "", following));
};

const suiteRuns = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] =>
  dependencies.suites
    .filter((suite) => scope.everything || touches(scope, suite.triggers))
    .map((suite) => ({ suite, files: selectedFiles(dependencies, suite) }))
    .filter(({ files }) => files.length > 0)
    .map(({ suite, files }) => ({
      name: suite.name,
      files,
      command: (suite.command ?? dependencies.testCommand)(files),
    }));

const looseRun = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] => {
  const files = presentPaths(scope.changes).filter(globMatcher(dependencies.looseTests));
  return scope.everything || files.length === 0
    ? []
    : [{ name: "changed tests", files, command: dependencies.testCommand(files) }];
};

const probesOf = (capabilities: Capabilities): Probes =>
  Object.fromEntries(CAPABILITIES.map((id) => [id, capabilities.probe(id)])) as Probes;

const unnamedFailure = (run: Run, output: string, exitCode: number): Finding => {
  const summary = output.split(/\r?\n/).filter((line) => /^\s*\d+ fail/.test(line));
  return {
    subject: run.name,
    violation: `bun test failed (${summary.join(" ").trim() || `exit ${exitCode}`})`,
    fix:
      `Run ${run.command.argv.slice(1).join(" ")} and fix the code or the failing test; ` +
      "never skip, loosen or delete a test to get green.",
  };
};

const regression = (run: Run, name: string): Finding => ({
  subject: `${run.name} · ${name}`,
  violation: "failed, and no capability this machine lacks accounts for it",
  fix:
    `Run ${run.command.argv.slice(1).join(" ")} and fix the code or the failing test; ` +
    "never skip, loosen or delete a test to get green.",
});

const judgeRun = (dependencies: TestsDependencies, run: Run): RunVerdict => {
  const result = dependencies.runner.capture(run.command);
  if (result.exitCode === 0) {
    return { findings: [], excluded: "" };
  }
  const failed = failedCases(result.output);
  if (failed.length === 0) {
    return { findings: [unnamedFailure(run, result.output, result.exitCode)], excluded: "" };
  }
  const probes = probesOf(dependencies.capabilities);
  const classification = classifyFailures({
    failed,
    exclusions: dependencies.exclusions,
    probes,
  });
  return {
    findings: classification.regressions.map((name) => regression(run, name)),
    excluded: excludedNote(classification.excluded),
  };
};

export const testsCheck = (dependencies: TestsDependencies): GateCheck => ({
  id: "tests",
  run: async (scope) => {
    const runs = [...suiteRuns(dependencies, scope), ...looseRun(dependencies, scope)];
    if (runs.length === 0) {
      return skipped("tests", "no changed context has tests");
    }
    const verdicts = runs.map((run) => judgeRun(dependencies, run));
    const ran = runs.map((run) => `${run.name} (${run.files.length})`).join(", ");
    const excluded = verdicts.map((verdict) => verdict.excluded).filter((note) => note !== "");
    const note = excluded.length === 0 ? ran : `${ran}; ${excluded.join("; ")}`;
    return judged({ id: "tests", findings: verdicts.flatMap((v) => v.findings), note });
  },
});
