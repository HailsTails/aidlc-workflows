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
