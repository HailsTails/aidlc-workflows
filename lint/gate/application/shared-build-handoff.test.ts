import { describe, expect, test } from "bun:test";
import { changedLegacyCommand } from "../adapters/legacy-suites.ts";
import type { GateScope } from "./gate-scope.ts";
import { goldensCheck } from "./goldens-check.ts";
import type { Command, CommandRunner } from "./ports.ts";
import { sharedBuild } from "./shared-build.ts";
import { testsCheck } from "./tests-check.ts";

const FILE = "tests/unit/changed.test.ts";
const SCOPE: GateScope = {
  lane: undefined, base: { ref: "foundation", commit: "base" },
  changes: [{ path: FILE, kind: "modified" }], everything: false,
  build: false, record: false, allTests: false,
  heavy: { ensure: async () => ({ acquired: true }) },
};
const BUILD: Command = { label: "package", argv: ["bun", "scripts/package.ts"] };

const fixture = (exitCode = 0) => {
  const calls: Command[] = [];
  const runner: CommandRunner = {
    capture: (command) => {
      calls.push(command);
      return { exitCode: command === BUILD ? exitCode : 0, output: "" };
    },
    captureAll: async () => [], attach: () => 0,
  };
  const build = sharedBuild(runner, BUILD);
  const goldens = goldensCheck({
    runner, build, source: { measure: () => ({}) },
    store: { read: () => ({}), write: () => undefined }, install: () => [],
  });
  const tests = testsCheck({
    runner, build, suites: [], looseTests: ["tests/unit/**/*.test.ts"],
    testCommand: () => ({ label: "unused", argv: [] }),
    looseCommand: (files) => changedLegacyCommand({
      bun: "bun", environment: { PATH: "native" },
    }, files),
    workspace: { read: () => "", write: () => undefined, filesMatching: () => [] },
    capabilities: { probe: () => ({ available: true, evidence: "fake" }) },
    exclusions: [], reachOf: () => ({}),
  });
  return { calls, goldens, tests };
};

describe("scoped tests reuse the golden package build", () => {
  test("one successful build marks the actual changed-test runner ready", async () => {
    const f = fixture();
    expect((await f.goldens.run(SCOPE)).status).toBe("green");
    expect((await f.tests.run(SCOPE)).status).toBe("green");
    expect(f.calls.map((call) => call.argv)).toEqual([
      BUILD.argv,
      ["bun", "tests/run-tests.ts", "--unit", "--filter", "^(changed)", "--no-llm"],
    ]);
    expect(f.calls[1]?.env).toEqual({ PATH: "native", AIDLC_TEST_PACKAGE_READY: "1" });
  });
  test("a failed memoized build cannot launch tests or become readiness", async () => {
    const f = fixture(1);
    expect((await f.goldens.run(SCOPE)).status).toBe("red");
    expect((await f.tests.run(SCOPE)).status).toBe("red");
    expect(f.calls).toEqual([BUILD]);
  });
  test("tests-only scoped qualification ensures the package before readiness", async () => {
    const f = fixture();
    expect((await f.tests.run(SCOPE)).status).toBe("green");
    expect(f.calls[0]).toBe(BUILD);
    expect(f.calls[1]?.env?.["AIDLC_TEST_PACKAGE_READY"]).toBe("1");
  });
});
