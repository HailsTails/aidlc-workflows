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
import { fileTimings, slowestNote, type FileTiming } from "../domain/test-timing.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type { Capabilities, Command, CommandRunner, Workspace } from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";

export type TestSuite = {
  readonly name: string;
  readonly triggers: readonly string[];
  readonly tests: readonly string[];
  readonly following?: readonly string[];
  readonly command?: (files: readonly string[]) => Command;
  readonly sharesPackageBuild?: boolean;
};

export type TestsDependencies = {
  readonly runner: CommandRunner;
  readonly workspace: Workspace;
  readonly suites: readonly TestSuite[];
  readonly looseTests: readonly string[];
  readonly testCommand: (files: readonly string[]) => Command;
  readonly capabilities: Capabilities;
  readonly exclusions: readonly CapabilityExclusion[];
  readonly build: SharedBuild;
};

type Run = {
  readonly name: string;
  readonly files: readonly string[];
  readonly command: Command;
  readonly sharesPackageBuild: boolean;
};

type RunVerdict = {
  readonly findings: readonly Finding[];
  readonly excluded: string;
  readonly timings: readonly FileTiming[];
};

const SLOWEST_FILES = 10;

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
      sharesPackageBuild: suite.sharesPackageBuild === true,
    }));

const looseRun = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] => {
  const files = presentPaths(scope.changes).filter(globMatcher(dependencies.looseTests));
  return scope.everything || files.length === 0
    ? []
    : [
        {
          name: "changed tests",
          files,
          command: dependencies.testCommand(files),
          sharesPackageBuild: false,
        },
      ];
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

const PACKAGE_READY = { AIDLC_TEST_PACKAGE_READY: "1" } as const;

const withPackageReady = (command: Command): Command =>
  command.env === undefined ? command : { ...command, env: { ...command.env, ...PACKAGE_READY } };

const buildFailureVerdict = (finding: Finding): RunVerdict => ({
  findings: [finding],
  excluded: "",
  timings: [],
});

const judgeRun = (request: {
  readonly dependencies: TestsDependencies;
  readonly run: Run;
  readonly scope: GateScope;
}): RunVerdict => {
  const { dependencies, scope } = request;
  const sharing = request.run.sharesPackageBuild && scope.build;
  const built = sharing ? dependencies.build.ensure() : undefined;
  if (built !== undefined) {
    return buildFailureVerdict(built);
  }
  const command = sharing ? withPackageReady(request.run.command) : request.run.command;
  const run = { ...request.run, command };
  const result = dependencies.runner.capture(run.command);
  const timings = fileTimings(result.output);
  if (result.exitCode === 0) {
    return { findings: [], excluded: "", timings };
  }
  const failed = failedCases(result.output);
  if (failed.length === 0) {
    return {
      findings: [unnamedFailure(run, result.output, result.exitCode)],
      excluded: "",
      timings,
    };
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
    timings,
  };
};

export const testsCheck = (dependencies: TestsDependencies): GateCheck => ({
  id: "tests",
  run: async (scope) => {
    const runs = [...suiteRuns(dependencies, scope), ...looseRun(dependencies, scope)];
    if (runs.length === 0) {
      return skipped("tests", "no changed context has tests");
    }
    const verdicts = runs.map((run) => judgeRun({ dependencies, run, scope }));
    const ran = runs.map((run) => `${run.name} (${run.files.length})`).join(", ");
    const excluded = verdicts.map((verdict) => verdict.excluded).filter((note) => note !== "");
    const slowest = slowestNote(verdicts.flatMap((verdict) => verdict.timings), SLOWEST_FILES);
    const note = [ran, ...excluded, slowest].filter((part) => part !== "").join("; ");
    return judged({ id: "tests", findings: verdicts.flatMap((v) => v.findings), note });
  },
});
