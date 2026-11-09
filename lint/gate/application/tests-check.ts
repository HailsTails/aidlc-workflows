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
import { impactedTests, type TestReach } from "../domain/test-impact.ts";
import { pathsOf } from "../domain/change.ts";
import type { GateCheck } from "./gate-check.ts";
import { touches, type GateScope } from "./gate-scope.ts";
import type {
  Capabilities,
  Command,
  CommandResult,
  CommandRunner,
  Workspace,
} from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";

export type TestSuite = {
  readonly name: string;
  readonly triggers: readonly string[];
  readonly tests: readonly string[];
  readonly following?: readonly string[];
  readonly command?: (files: readonly string[]) => Command;
  readonly commands?: (files: readonly string[]) => readonly Command[];
  readonly concurrency?: number;
  readonly sharesPackageBuild?: boolean;
  readonly heavy?: boolean;
  readonly selectsByImpact?: boolean;
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
  readonly reachOf: (tests: readonly string[]) => TestReach;
};

type Run = {
  readonly name: string;
  readonly files: readonly string[];
  readonly commands: readonly Command[];
  readonly concurrency: number;
  readonly sharesPackageBuild: boolean;
  readonly heavy: boolean;
  readonly available: number;
};

type RunVerdict = {
  readonly findings: readonly Finding[];
  readonly excluded: string;
  readonly timings: readonly FileTiming[];
};

const SLOWEST_FILES = 10;

const OUTPUT_SEPARATOR = String.fromCharCode(10);

const CAPABILITIES: readonly CapabilityId[] = ["symlinks", "short-names", "listable-system-temp"];

const follows = (text: string, modules: readonly string[]): boolean =>
  importsAnyOf({ text, modules });

const followingFiles = (dependencies: TestsDependencies, suite: TestSuite): readonly string[] => {
  const { workspace } = dependencies;
  const files = workspace.filesMatching(suite.tests);
  const { following } = suite;
  return following === undefined
    ? files
    : files.filter((file) => follows(workspace.read(file) ?? "", following));
};

const impactedFiles = (
  dependencies: TestsDependencies,
  request: {
    readonly suite: TestSuite;
    readonly scope: GateScope;
    readonly files: readonly string[];
  },
): readonly string[] => {
  const { suite, scope, files } = request;
  const selecting = suite.selectsByImpact === true && !scope.allTests && scope.base !== undefined;
  return selecting
    ? impactedTests({
        tests: files,
        reach: dependencies.reachOf(files),
        changed: pathsOf(scope.changes),
      })
    : files;
};

const commandsOf = (
  dependencies: TestsDependencies,
  suite: TestSuite,
  files: readonly string[],
): readonly Command[] =>
  suite.commands?.(files) ?? [(suite.command ?? dependencies.testCommand)(files)];

const suiteRuns = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] =>
  dependencies.suites
    .filter((suite) => scope.everything || touches(scope, suite.triggers))
    .map((suite) => ({ suite, available: followingFiles(dependencies, suite) }))
    .map(({ suite, available }) => ({
      suite,
      available: available.length,
      files: impactedFiles(dependencies, { suite, scope, files: available }),
    }))
    .filter(({ files }) => files.length > 0)
    .map(({ suite, files, available }) => ({
      name: suite.name,
      files,
      available,
      commands: commandsOf(dependencies, suite, files),
      concurrency: suite.concurrency ?? 1,
      sharesPackageBuild: suite.sharesPackageBuild === true,
      heavy: suite.heavy === true,
    }));

const looseRun = (
  dependencies: TestsDependencies, scope: GateScope, covered: ReadonlySet<string>,
): readonly Run[] => {
  const files = presentPaths(scope.changes)
    .filter(globMatcher(dependencies.looseTests))
    .filter((file) => !covered.has(file));
  return scope.everything || files.length === 0
    ? []
    : [
        {
          name: "changed tests",
          files,
          commands: [dependencies.testCommand(files)],
          concurrency: 1,
          sharesPackageBuild: false,
          heavy: false,
          available: files.length,
        },
      ];
};

const probesOf = (capabilities: Capabilities): Probes =>
  Object.fromEntries(CAPABILITIES.map((id) => [id, capabilities.probe(id)])) as Probes;

const countOf = (run: Run): string =>
  run.files.length === run.available
    ? `${run.files.length}`
    : `${run.files.length} of ${run.available}`;

const hintOf = (command: Command): string => command.argv.slice(1).join(" ");

const NEVER_SKIP = "never skip, loosen or delete a test to get green.";

type Execution = { readonly command: Command; readonly result: CommandResult };

const unnamedFailure = (run: Run, execution: Execution): Finding => {
  const { command, result } = execution;
  const lines = result.output.split(String.fromCharCode(10));
  const summary = lines.filter((line) => /^[ ]*[0-9]+ fail/.test(line));
  return {
    subject: run.name,
    violation: `bun test failed (${summary.join(" ").trim() || `exit ${result.exitCode}`})`,
    fix: `Run ${hintOf(command)} and fix the code or the failing test; ${NEVER_SKIP}`,
  };
};

const regression = (run: Run, failure: { readonly name: string; readonly command: Command }) => ({
  subject: `${run.name} · ${failure.name}`,
  violation: "failed, and no capability this machine lacks accounts for it",
  fix: `Run ${hintOf(failure.command)} and fix the code or the failing test; ${NEVER_SKIP}`,
});

const PACKAGE_READY = { AIDLC_TEST_PACKAGE_READY: "1" } as const;

const withPackageReady = (command: Command): Command =>
  command.env === undefined ? command : { ...command, env: { ...command.env, ...PACKAGE_READY } };

const noSlot = (reason: string): Finding => ({
  subject: "machine lock",
  violation: `the legacy suites need a machine lock slot and none was free: ${reason}`,
  fix:
    "Raise --wait, or run this scope with --only on the checks that need no slot " +
    "(everything except tests and goldens).",
});

const buildFailureVerdict = (finding: Finding): RunVerdict => ({
  findings: [finding],
  excluded: "",
  timings: [],
});

const executionsOf = async (
  dependencies: TestsDependencies,
  run: Run,
): Promise<readonly Execution[]> => {
  const [only] = run.commands;
  if (run.commands.length === 1 && only !== undefined) {
    return [{ command: only, result: dependencies.runner.capture(only) }];
  }
  const results = await dependencies.runner.captureAll({
    commands: run.commands,
    concurrency: run.concurrency,
  });
  return run.commands.map((command, index) => ({
    command,
    result: results[index] ?? { exitCode: 1, output: "" },
  }));
};

const judgeExecutions = (request: {
  readonly dependencies: TestsDependencies;
  readonly run: Run;
  readonly executions: readonly Execution[];
}): RunVerdict => {
  const { dependencies, run, executions } = request;
  const timings = fileTimings(
    executions.map((execution) => execution.result.output).join(OUTPUT_SEPARATOR),
  );
  const failing = executions.filter((execution) => execution.result.exitCode !== 0);
  const named = failing.flatMap((execution) =>
    failedCases(execution.result.output).map((name) => ({ name, command: execution.command })),
  );
  const unnamed = failing.filter((execution) => failedCases(execution.result.output).length === 0);
  const classification = classifyFailures({
    failed: [...new Set(named.map(({ name }) => name))],
    exclusions: dependencies.exclusions,
    probes: probesOf(dependencies.capabilities),
  });
  const regressions = classification.regressions.flatMap((name) => {
    const failure = named.find((candidate) => candidate.name === name);
    return failure === undefined ? [] : [regression(run, failure)];
  });
  return {
    findings: [...unnamed.map((execution) => unnamedFailure(run, execution)), ...regressions],
    excluded: excludedNote(classification.excluded),
    timings,
  };
};

const beforeRunning = async (request: {
  readonly dependencies: TestsDependencies;
  readonly run: Run;
  readonly scope: GateScope;
}): Promise<Finding | undefined> => {
  const { run, scope } = request;
  const slot = run.heavy ? await scope.heavy.ensure() : { acquired: true as const };
  if (!slot.acquired) {
    return noSlot(slot.reason);
  }
  return run.sharesPackageBuild && scope.build ? request.dependencies.build.ensure() : undefined;
};

const judgeRun = async (request: {
  readonly dependencies: TestsDependencies;
  readonly run: Run;
  readonly scope: GateScope;
}): Promise<RunVerdict> => {
  const { dependencies, scope } = request;
  const blocked = await beforeRunning({ dependencies, run: request.run, scope });
  if (blocked !== undefined) {
    return buildFailureVerdict(blocked);
  }
  const sharing = request.run.sharesPackageBuild && scope.build;
  const commands = sharing ? request.run.commands.map(withPackageReady) : request.run.commands;
  const run = { ...request.run, commands };
  const executions = await executionsOf(dependencies, run);
  return judgeExecutions({ dependencies, run, executions });
};

export const testsCheck = (dependencies: TestsDependencies): GateCheck => ({
  id: "tests",
  run: async (scope) => {
    const suites = suiteRuns(dependencies, scope);
    const covered = new Set(suites.flatMap((suite) => suite.files));
    const runs = [...suites, ...looseRun(dependencies, scope, covered)];
    if (runs.length === 0) {
      return skipped("tests", "no changed context has tests");
    }
    const verdicts = await Promise.all(runs.map((run) => judgeRun({ dependencies, run, scope })));
    const ran = runs.map((run) => `${run.name} (${countOf(run)})`).join(", ");
    const excluded = verdicts.map((verdict) => verdict.excluded).filter((note) => note !== "");
    const slowest = slowestNote(verdicts.flatMap((verdict) => verdict.timings), SLOWEST_FILES);
    const note = [ran, ...excluded, slowest].filter((part) => part !== "").join("; ");
    return judged({ id: "tests", findings: verdicts.flatMap((v) => v.findings), note });
  },
});
