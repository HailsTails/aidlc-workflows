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
    { workspace, workers: 2, splitAtOrAbove: 60 },
  );
  const matrix = suites[1];
  const commands = matrix?.commands?.([
    "tests/unit/big.test.ts",
    "tests/unit/a.test.ts",
    "tests/unit/b.test.ts",
  ]);

  test("a heavy file is split by describe block and the rest share one run", () => {
    const patterns = commands?.map((command) => command.argv.includes("--test-name-pattern"));
    expect(patterns).toEqual([true, true, true, false]);
  });

  test("every shard of the heavy file selects that one file, and the others select theirs", () => {
    const filters = commands?.map((command) => command.argv[command.argv.indexOf("--filter") + 1]);
    expect(filters).toEqual(["^(big)", "^(big)", "^(big)", "^(a|b)"]);
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
