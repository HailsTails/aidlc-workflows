import { filterPattern } from "../domain/legacy-selection.ts";
import type { TestSuite } from "../application/tests-check.ts";
import type { Command } from "../application/ports.ts";

const INHERITED_NAMES = [
  "PATH",
  "SystemRoot",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "TMPDIR",
] as const;

export const legacyEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    INHERITED_NAMES.flatMap((name) => {
      const value = source[name];
      return value === undefined ? [] : [[name, value] as const];
    }),
  );

const SOURCES_THAT_MOVE_LEGACY_TESTS = [
  "harness/**",
  "core/**",
  "src/**",
  "tests/harness/**",
  "tests/fixtures/**",
];

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

export const legacySuites = (runner: LegacyRunner): readonly TestSuite[] => [
  {
    name: "legacy smoke",
    triggers: [...SOURCES_THAT_MOVE_LEGACY_TESTS, "tests/smoke/**"],
    tests: ["tests/smoke/**/*.test.ts"],
    command: () => runnerCommand({ runner, label: "legacy smoke", args: ["--smoke"] }),
  },
  {
    name: "legacy tests on the harness matrix",
    triggers: [...SOURCES_THAT_MOVE_LEGACY_TESTS, "tests/unit/**"],
    tests: ["tests/unit/**/*.test.ts"],
    following: ["harness-matrix"],
    command: (files) =>
      runnerCommand({
        runner,
        label: "legacy tests on the harness matrix",
        args: ["--unit", "--filter", filterPattern(files)],
      }),
  },
];
