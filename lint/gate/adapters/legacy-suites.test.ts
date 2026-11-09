import { testsCheck } from "../application/tests-check.ts";
import { globMatcher } from "../domain/glob.ts";
import type { Command } from "../application/ports.ts";
import { describe, expect, test } from "bun:test";
import { legacyEnvironment, legacySuites } from "./legacy-suites.ts";

describe("legacy suites", () => {
  test("the runner environment is built from named variables, never inherited whole", () => {
    const environment = legacyEnvironment({
      PATH: "/bin",
      HOME: "/home/x",
      AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1",
      SECRET_TOKEN: "s",
    });
    expect(environment).toEqual({ PATH: "/bin", HOME: "/home/x" });
  });

  test("both legacy suites run the repository runner with the explicit environment", () => {
    const environment = { PATH: "/bin" };
    const suites = legacySuites({ bun: "bun", environment });
    const commands = suites.map((suite) => suite.command?.(["tests/unit/t177.test.ts"]));
    expect(commands.map((command) => command?.env)).toEqual([environment, environment]);
    expect(commands[0]?.argv).toEqual(["bun", "tests/run-tests.ts", "--smoke", "--no-llm"]);
    expect(commands[1]?.argv).toEqual([
      "bun",
      "tests/run-tests.ts",
      "--unit",
      "--filter",
      "^(t177)",
      "--no-llm",
    ]);
  });
});

describe("legacy matrix plan", () => {
  const WEIGHTS = JSON.stringify({
    defaultSeconds: 1,
    weights: { "big.test.ts": 200, "a.test.ts": 3, "b.test.ts": 2 },
  });
  const BIG_SOURCE = 'describe("one", () => {});\ndescribe("two", () => {});';
  const workspace = {
    read: (path: string) =>
      ({
        "tests/unit-shard-weights.json": WEIGHTS,
        "tests/unit/big.test.ts": BIG_SOURCE,
      })[path],
    write: () => undefined,
    filesMatching: () => [],
  };
  const suites = legacySuites(
    { bun: "bun", environment: {} },
    { workspace, workers: 2, splitAtOrAbove: 60, targetSeconds: 150 },
  );
  const matrix = suites[1];
  const commands = matrix?.commands?.([
    "tests/unit/big.test.ts",
    "tests/unit/a.test.ts",
    "tests/unit/b.test.ts",
  ]);

  test("a heavy file splits per describe block and the rest share one run", () => {
    const patterns = commands?.map((command) => command.argv.includes("--test-name-pattern"));
    expect(patterns).toEqual([true, true, false]);
  });

  test("every shard of the heavy file selects that one file, and the others select theirs", () => {
    const filters = commands?.map((command) => command.argv[command.argv.indexOf("--filter") + 1]);
    expect(filters).toEqual(["^(big)", "^(big)", "^(a|b)"]);
  });

  test("the suite declares how many runs go side by side", () => {
    expect(matrix?.concurrency).toBe(2);
  });
});

describe("legacy transpiler cache", () => {
  test("a given cache folder is the only addition to the named variables", () => {
    const environment = legacyEnvironment({ PATH: "/bin", SECRET: "s" }, "/cache");
    expect(environment).toEqual({ PATH: "/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "/cache" });
  });
});

const LEGACY_FILES = ["tests/smoke/s.test.ts", "tests/unit/a.test.ts", "tests/unit/b.test.ts"];
const ALL_LEGACY = [
  ["bun", "tests/run-tests.ts", "--smoke", "--no-llm"],
  ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(a|b)", "--no-llm"],
];
const KNOWN_LEGACY = [
  ["bun", "tests/run-tests.ts", "--smoke", "--no-llm"],
  ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(a)", "--no-llm"],
];

const selectedLegacy = async (changed: readonly string[]): Promise<readonly string[][]> => {
  const commands: string[][] = [];
  const capture = (command: Command) => {
    commands.push([...command.argv]);
    return { exitCode: 0, output: "" };
  };
  const check = testsCheck({
    runner: { capture, captureAll: async () => [], attach: () => 0 },
    workspace: {
      read: () => 'import { x } from "../harness/harness-matrix.ts";',
      write: () => undefined,
      filesMatching: (globs) => LEGACY_FILES.filter(globMatcher(globs)),
    },
    suites: legacySuites({ bun: "bun", environment: {} }),
    looseTests: [],
    testCommand: () => ({ label: "unexpected loose test", argv: ["unexpected"] }),
    capabilities: { probe: () => ({ available: true, evidence: "fixture" }) },
    exclusions: [], build: { ensure: () => undefined },
    reachOf: () => ({
      "tests/unit/a.test.ts": ["core/a.ts"],
      "tests/unit/b.test.ts": ["core/b.ts"],
    }),
  });
  await check.run({
    lane: undefined, base: { ref: "foundation", commit: "abc" },
    changes: changed.map((path) => ({ path, kind: "modified" })),
    everything: false, build: false, record: false, allTests: false,
    heavy: { ensure: async () => ({ acquired: true }) },
  });
  return commands;
};

describe("legacy admission preserves conservative impact selection", () => {
  test.each([
    "scripts/package.ts", "package.json", "bun.lock", "bunfig.toml",
    "tsconfig.json", "tsconfig.tests.json", "tests/run-tests.ts",
    "tests/unit-shard-weights.json", "tests/lib/shared.ts", "tests/golden/kiro.json",
    "tests/harness/shared.ts", "tests/fixtures/input.json",
  ])("global input %s admits every legacy test", async (path) => {
    expect(await selectedLegacy([path])).toEqual(ALL_LEGACY);
  });

  test("a known source change still selects only its reachable matrix file", async () => {
    expect(await selectedLegacy(["core/a.ts"])).toEqual(KNOWN_LEGACY);
  });

  test("an unknown path outside the old trigger families selects everything", async () => {
    expect(await selectedLegacy(["unknown/path.ts"])).toEqual(ALL_LEGACY);
  });

  test("a mixed known and unknown change cannot silently drop the unknown impact", async () => {
    expect(await selectedLegacy(["core/a.ts", "unknown/path.ts"])).toEqual(ALL_LEGACY);
  });

  test("an ordinary scoped run with no changes selects nothing", async () => {
    expect(await selectedLegacy([])).toEqual([]);
  });
});