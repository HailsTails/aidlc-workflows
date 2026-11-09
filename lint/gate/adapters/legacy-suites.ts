import { z } from "zod";
import { filterPattern } from "../domain/legacy-selection.ts";
import { planItems, type PlanItem } from "../domain/test-sharding.ts";
import type { TestSuite } from "../application/tests-check.ts";
import type { Command, Workspace } from "../application/ports.ts";
import { casesOfFile } from "./case-weights-file.ts";
import { hasTestsOutsideNamedDescribes, topLevelDescribes } from "./describe-reader.ts";

const INHERITED_NAMES = [
  "PATH",
  "SystemRoot",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
] as const;

export const TRANSPILER_CACHE_VARIABLE = "BUN_RUNTIME_TRANSPILER_CACHE_PATH";

export const legacyEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
  transpilerCache?: string,
): Readonly<Record<string, string>> => ({
  ...Object.fromEntries(
    INHERITED_NAMES.flatMap((name) => {
      const value = source[name];
      return value === undefined ? [] : [[name, value] as const];
    }),
  ),
  ...(transpilerCache === undefined ? {} : { [TRANSPILER_CACHE_VARIABLE]: transpilerCache }),
});

export type LegacyRunner = {
  readonly bun: string;
  readonly environment: Readonly<Record<string, string>>;
};

const runnerCommand = (request: {
  readonly runner: LegacyRunner;
  readonly label: string;
  readonly args: readonly string[];
}): Command => ({
  label: request.label,
  argv: [request.runner.bun, "tests/run-tests.ts", ...request.args, "--no-llm"],
  env: request.runner.environment,
});

export type LegacyPlanning = {
  readonly workspace: Workspace;
  readonly workers: number;
  readonly splitAtOrAbove: number;
  readonly targetSeconds: number;
};

const WEIGHTS_PATH = "tests/unit-shard-weights.json";

const WeightsSchema = z.object({
  defaultSeconds: z.number().positive(),
  weights: z.record(z.string(), z.number()),
});

const baseName = (file: string): string => file.split("/").pop() ?? file;

const weightsOf = (workspace: Workspace): ((file: string) => number) => {
  const text = workspace.read(WEIGHTS_PATH);
  const parsed = WeightsSchema.safeParse(text === undefined ? undefined : JSON.parse(text));
  const known = parsed.success ? parsed.data : { defaultSeconds: 1, weights: {} };
  return (file) => known.weights[baseName(file)] ?? known.defaultSeconds;
};

const itemCommand = (runner: LegacyRunner, item: PlanItem): Command => {
  const select = ["--unit", "--filter", filterPattern(item.files)];
  const shard = item.pattern === undefined ? [] : ["--test-name-pattern", item.pattern];
  const mayBeEmpty = item.canBeEmpty === true ? ["--allow-empty-shard"] : [];
  return runnerCommand({
    runner,
    label: "legacy tests on the harness matrix",
    args: [...select, ...shard, ...mayBeEmpty],
  });
};

const matrixCommands = (
  runner: LegacyRunner,
  planning: LegacyPlanning,
  files: readonly string[],
): readonly Command[] =>
  planItems({
    files,
    weightOf: weightsOf(planning.workspace),
    describesOf: (file) => topLevelDescribes(planning.workspace.read(file) ?? ""),
    hasOtherTests: (file) => hasTestsOutsideNamedDescribes(planning.workspace.read(file) ?? ""),
    splitAtOrAbove: planning.splitAtOrAbove,
    groups: Math.max(1, Math.floor(planning.workers / 2)),
    casesOf: casesOfFile(planning.workspace),
    targetSeconds: planning.targetSeconds,
  }).map((item) => itemCommand(runner, item));

export const legacySuites = (
  runner: LegacyRunner,
  planning?: LegacyPlanning,
): readonly TestSuite[] => [
  {
    name: "legacy smoke",
    triggers: ["**"],
    tests: ["tests/smoke/**/*.test.ts"],
    sharesPackageBuild: true,
    heavy: true,
    command: () => runnerCommand({ runner, label: "legacy smoke", args: ["--smoke"] }),
  },
  {
    name: "legacy tests on the harness matrix",
    triggers: ["**"],
    tests: ["tests/unit/**/*.test.ts"],
    following: ["harness-matrix"],
    sharesPackageBuild: true,
    heavy: true,
    selectsByImpact: true,
    command: (files) =>
      runnerCommand({
        runner,
        label: "legacy tests on the harness matrix",
        args: ["--unit", "--filter", filterPattern(files)],
      }),
    ...(planning === undefined
      ? {}
      : {
          commands: (files: readonly string[]) => matrixCommands(runner, planning, files),
          concurrency: planning.workers,
        }),
  },
];
