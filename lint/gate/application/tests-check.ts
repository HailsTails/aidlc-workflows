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
  readonly commands: readonly Command[];
  readonly concurrency: number;
  readonly sharesPackageBuild: boolean;
  readonly heavy: boolean;
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

const selectedFiles = (dependencies: TestsDependencies, suite: TestSuite): readonly string[] => {
  const { workspace } = dependencies;
  const files = workspace.filesMatching(suite.tests);
  const { following } = suite;
  return following === undefined
    ? files
    : files.filter((file) => follows(workspace.read(file) ?? "", following));
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
    .map((suite) => ({ suite, files: selectedFiles(dependencies, suite) }))
    .filter(({ files }) => files.length > 0)
    .map(({ suite, files }) => ({
      name: suite.name,
      files,
      commands: commandsOf(dependencies, suite, files),
      concurrency: suite.concurrency ?? 1,
      sharesPackageBuild: suite.sharesPackageBuild === true,
      heavy: suite.heavy === true,
    }));

const looseRun = (dependencies: TestsDependencies, scope: GateScope): readonly Run[] => {
  const files = presentPaths(scope.changes).filter(globMatcher(dependencies.looseTests));
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
        },
      ];
};

const probesOf = (capabilities: Capabilities): Probes =>
  Object.fromEntries(CAPABILITIES.map((id) => [id, capabilities.probe(id)])) as Probes;

const hintOf = (run: Run): string =>
  (run.commands[0]?.argv ?? []).slice(1).join(" ");

const unnamedFailure = (run: Run, output: string, exitCode: number): Finding => {
  const summary = output.split(/\r?\n/).filter((line) => /^\s*\d+ fail/.test(line));
  return {
    subject: run.name,
    violation: `bun test failed (${summary.join(" ").trim() || `exit ${exitCode}`})`,
    fix:
      `Run ${hintOf(run)} and fix the code or the failing test; ` +
      "never skip, loosen or delete a test to get green.",
  };
};

const regression = (run: Run, name: string): Finding => ({
  subject: `${run.name} · ${name}`,
  violation: "failed, and no capability this machine lacks accounts for it",
  fix:
    `Run ${hintOf(run)} and fix the code or the failing test; ` +
    "never skip, loosen or delete a test to get green.",
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

const resultOf = async (dependencies: TestsDependencies, run: Run): Promise<CommandResult> => {
  const [only] = run.commands;
  if (run.commands.length === 1 && only !== undefined) {
    return dependencies.runner.capture(only);
  }
  const results = await dependencies.runner.captureAll({
    commands: run.commands,
    concurrency: run.concurrency,
  });
  const failing = results.find((result) => result.exitCode !== 0);
  return {
    exitCode: failing?.exitCode ?? 0,
    output: results.map((result) => result.output).join(OUTPUT_SEPARATOR),
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
  const result = await resultOf(dependencies, run);
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
    const verdicts = await Promise.all(runs.map((run) => judgeRun({ dependencies, run, scope })));
    const ran = runs.map((run) => `${run.name} (${run.files.length})`).join(", ");
    const excluded = verdicts.map((verdict) => verdict.excluded).filter((note) => note !== "");
    const slowest = slowestNote(verdicts.flatMap((verdict) => verdict.timings), SLOWEST_FILES);
    const note = [ran, ...excluded, slowest].filter((part) => part !== "").join("; ");
    return judged({ id: "tests", findings: verdicts.flatMap((v) => v.findings), note });
  },
});
