import { describe, expect, test } from "bun:test";
import type { GateScope } from "./gate-scope.ts";
import type { Command, CommandResult, LockOutcome, Workspace } from "./ports.ts";
import type { SharedBuild } from "./shared-build.ts";
import { testsCheck, type TestSuite } from "./tests-check.ts";

const SCOPE: GateScope = {
  lane: undefined,
  base: undefined,
  changes: [],
  everything: true,
  build: false,
  record: false,
  allTests: false,
  heavy: { ensure: async () => ({ acquired: true }) },
};
const SUITE: TestSuite = { name: "legacy", triggers: ["**"], tests: ["tests/**/*.test.ts"] };
const LISTED = "t243 > rejects symlink traversal";

const failing = (cases: readonly string[]): CommandResult => ({
  exitCode: 1,
  output: cases.map((name) => `(fail) ${name} [3.2ms]`).join("\n"),
});

const workspaceOf = (files: Readonly<Record<string, string>>): Workspace => ({
  read: (path) => files[path],
  write: () => undefined,
  filesMatching: () => Object.keys(files),
});

const checkWith = (request: {
  readonly result: CommandResult;
  readonly symlinks: boolean;
  readonly suite?: TestSuite;
  readonly files?: Readonly<Record<string, string>>;
  readonly build?: SharedBuild;
}) =>
  testsCheck({
    runner: { capture: () => request.result, captureAll: async () => [],
    attach: () => 0 },
    workspace: workspaceOf(request.files ?? { "tests/a.test.ts": "" }),
    suites: [request.suite ?? SUITE],
    looseTests: [],
    testCommand: () => ({ label: "bun test", argv: ["bun", "test"] }),
    capabilities: {
      probe: (id) =>
        id === "symlinks" && !request.symlinks
          ? { available: false, evidence: "creating a symlink is refused (EPERM)" }
          : { available: true, evidence: "present" },
    },
    exclusions: [{ capability: "symlinks", cases: [LISTED] }],
    build: request.build ?? { ensure: () => undefined },
    reachOf: () => ({}),
  });

describe("the tests check tells capability reds from regressions", () => {
  test("green: a listed case failing without its capability passes and is named", async () => {
    const check = checkWith({ result: failing([LISTED]), symlinks: false });
    const outcome = await check.run(SCOPE);
    expect(outcome.findings).toEqual([]);
    expect(outcome.note).toContain("1 case(s) excluded for symlinks");
  });

  test("red: a failing case outside the list is a regression named by suite and case", async () => {
    const check = checkWith({ result: failing([LISTED, "t9 > broke"]), symlinks: false });
    const outcome = await check.run(SCOPE);
    expect(outcome.findings.map((finding) => finding.subject)).toEqual(["legacy · t9 > broke"]);
  });

  test("red: a listed case failing where the capability exists is a regression", async () => {
    const outcome = await checkWith({ result: failing([LISTED]), symlinks: true }).run(SCOPE);
    expect(outcome.findings.map((finding) => finding.subject)).toEqual([`legacy · ${LISTED}`]);
  });

  test("red: a non-zero exit that names no case is still a failure", async () => {
    const result: CommandResult = { exitCode: 1, output: "error: cannot load module" };
    const outcome = await checkWith({ result, symlinks: false }).run(SCOPE);
    expect(outcome.findings).toHaveLength(1);
  });

  test("the note names the slowest files with their durations", async () => {
    const output = [
      "=== START a.test.ts ===",
      "Ran 1 test across 1 file. [900.00ms]",
      "=== START b.test.ts ===",
      "Ran 1 test across 1 file. [4.00s]",
    ].join("\n");
    const outcome = await checkWith({ result: { exitCode: 0, output }, symlinks: true }).run(SCOPE);
    expect(outcome.note).toContain("slowest files: b.test.ts 4.0s, a.test.ts 0.9s");
  });

  test("a suite that follows a module runs only the files that import it", async () => {
    const ran: (readonly string[])[] = [];
    const suite: TestSuite = {
      ...SUITE,
      following: ["harness-matrix"],
      command: (files) => {
        ran.push(files);
        return { label: "run", argv: ["run"] };
      },
    };
    const files = {
      "tests/a.test.ts": 'import { x } from "./harness-matrix.ts";',
      "tests/b.test.ts": "export {};",
    };
    const result: CommandResult = { exitCode: 0, output: "" };
    await checkWith({ result, symlinks: true, suite, files }).run(SCOPE);
    expect(ran).toEqual([["tests/a.test.ts"]]);
  });
});

const BUILT_SCOPE: GateScope = { ...SCOPE, build: true };

describe("the tests check shares one package build", () => {
  const PACKAGED: TestSuite = { ...SUITE, sharesPackageBuild: true };

  const captured = (commands: Command[]) => ({
    capture: (command: Command): CommandResult => {
      commands.push(command);
      return { exitCode: 0, output: "" };
    },
    captureAll: async () => [],
    attach: () => 0,
  });

  const packagedCheck = (request: { readonly build: SharedBuild; readonly commands: Command[] }) =>
    testsCheck({
      runner: captured(request.commands),
      workspace: workspaceOf({ "tests/a.test.ts": "" }),
      suites: [PACKAGED],
      looseTests: [],
      testCommand: () => ({ label: "bun test", argv: ["bun", "test"], env: { PATH: "p" } }),
      capabilities: { probe: () => ({ available: true, evidence: "present" }) },
      exclusions: [],
      build: request.build,
      reachOf: () => ({}),
    });

  test("the suite runs with the build marked ready, after asking for the build", async () => {
    const commands: Command[] = [];
    let builds = 0;
    const build: SharedBuild = {
      ensure: () => {
        builds += 1;
        return undefined;
      },
    };

    await packagedCheck({ build, commands }).run(BUILT_SCOPE);

    expect(builds).toBe(1);
    expect(commands[0]?.env).toEqual({ PATH: "p", AIDLC_TEST_PACKAGE_READY: "1" });
  });

  test("red: a failed shared build is a finding and the suite does not run", async () => {
    const commands: Command[] = [];
    const finding = { subject: "build", violation: "failed: x", fix: "fix it" };

    const build: SharedBuild = { ensure: () => finding };

    const outcome = await packagedCheck({ build, commands }).run(BUILT_SCOPE);

    expect(outcome.findings).toEqual([finding]);
    expect(commands).toEqual([]);
  });

  test("with no build requested the suite is not marked ready", async () => {
    const commands: Command[] = [];
    const build: SharedBuild = { ensure: () => undefined };

    await packagedCheck({ build, commands }).run(SCOPE);

    expect(commands[0]?.env).toEqual({ PATH: "p" });
  });
});

const LEGACY: TestSuite = { ...SUITE, name: "legacy", heavy: true };
const LIGHT: TestSuite = { ...SUITE, name: "light" };

const GRANTED: LockOutcome = { acquired: true };
const REFUSED: LockOutcome = { acquired: false, reason: "no free slot" };

const slotWith = (acquired: boolean) => {
  const asked: number[] = [];
  const heavy = {
    ensure: async () => {
      asked.push(1);
      return acquired ? GRANTED : REFUSED;
    },
  };
  return { asked, heavy };
};

const check = (suite: TestSuite, commands: Command[]) =>
  testsCheck({
    runner: {
      capture: (command: Command): CommandResult => {
        commands.push(command);
        return { exitCode: 0, output: "" };
      },
      captureAll: async () => [],
      attach: () => 0,
    },
    workspace: workspaceOf({ "tests/a.test.ts": "" }),
    suites: [suite],
    looseTests: [],
    testCommand: () => ({ label: "bun test", argv: ["bun", "test"] }),
    capabilities: { probe: () => ({ available: true, evidence: "present" }) },
    exclusions: [],
    build: { ensure: () => undefined },
    reachOf: () => ({}),
  });

describe("the tests check takes a machine slot for the legacy suites only", () => {

  test("a heavy suite asks for the slot, and runs once it has it", async () => {
    const { asked, heavy } = slotWith(true);
    const commands: Command[] = [];

    await check(LEGACY, commands).run({ ...SCOPE, heavy });

    expect(asked).toHaveLength(1);
    expect(commands).toHaveLength(1);
  });

  test("red: with no slot free the heavy suite does not run and the finding says why", async () => {
    const { heavy } = slotWith(false);
    const commands: Command[] = [];

    const outcome = await check(LEGACY, commands).run({ ...SCOPE, heavy });

    expect(commands).toEqual([]);
    expect(outcome.findings.map((finding) => finding.subject)).toEqual(["machine lock"]);
  });

  test("a light suite never asks for the slot", async () => {
    const { asked, heavy } = slotWith(false);
    const commands: Command[] = [];

    await check(LIGHT, commands).run({ ...SCOPE, heavy });

    expect(asked).toEqual([]);
    expect(commands).toHaveLength(1);
  });
});

describe("a parallel suite names the run that failed", () => {
  const FIRST: Command = { label: "first", argv: ["bun", "first-shard"] };
  const SECOND: Command = { label: "second", argv: ["bun", "second-shard"] };
  const SPLIT: TestSuite = {
    ...SUITE,
    commands: () => [FIRST, SECOND],
    concurrency: 2,
  };

  const results: readonly CommandResult[] = [
    { exitCode: 0, output: "" },
    { exitCode: 1, output: "(fail) t9 > broke [3.2ms]" },
  ];

  const splitCheck = () =>
    testsCheck({
      runner: {
        capture: () => results[0] as CommandResult,
        captureAll: async () => results,
        attach: () => 0,
      },
      workspace: workspaceOf({ "tests/a.test.ts": "" }),
      suites: [SPLIT],
      looseTests: [],
      testCommand: () => FIRST,
      capabilities: { probe: () => ({ available: true, evidence: "present" }) },
      exclusions: [],
      build: { ensure: () => undefined },
      reachOf: () => ({}),
    });

  test("the fix names the command of the run the case failed in", async () => {
    const outcome = await splitCheck().run(SCOPE);

    expect(outcome.findings[0]?.fix).toContain("second-shard");
    expect(outcome.findings[0]?.fix).not.toContain("first-shard");
  });
});

const IDLE_RUNNER = {
  capture: () => ({ exitCode: 0, output: "" }),
  captureAll: async () => [],
  attach: () => 0,
};

const MATRIX: TestSuite = {
  ...SUITE,
  tests: ["tests/unit/**/*.test.ts"],
  selectsByImpact: true,
};
const FILES = ["tests/unit/a.test.ts", "tests/unit/b.test.ts"];
const REACH = {
  "tests/unit/a.test.ts": ["core/tools/a.ts"],
  "tests/unit/b.test.ts": ["core/tools/b.ts"],
};
const BASE = { ref: "origin/rebuild/foundation", commit: "abc" };

const changed = (path: string, allTests = false): GateScope => ({
  ...SCOPE,
  base: BASE,
  changes: [{ path, kind: "modified" }],
  allTests,
});

const recorded = (ran: (readonly string[])[], files: readonly string[]): Command => {
  ran.push(files);
  return { label: "m", argv: ["m"] };
};

const matrixCheck = (ran: (readonly string[])[]) =>
  testsCheck({
    runner: IDLE_RUNNER,
    workspace: { read: () => "", write: () => undefined, filesMatching: () => FILES },
    suites: [{ ...MATRIX, command: (files) => recorded(ran, files) }],
    looseTests: [],
    testCommand: () => ({ label: "bun test", argv: ["bun", "test"] }),
    capabilities: { probe: () => ({ available: true, evidence: "present" }) },
    exclusions: [],
    build: { ensure: () => undefined },
    reachOf: () => REACH,
  });

describe("the legacy matrix runs only what the change can reach", () => {

  test("a change reaches one test file, so only that file runs, and the note says so", async () => {
    const ran: (readonly string[])[] = [];

    const outcome = await matrixCheck(ran).run(changed("core/tools/a.ts"));

    expect(ran).toEqual([["tests/unit/a.test.ts"]]);
    expect(outcome.note).toContain("1 of 2");
  });

  test("red: --all-tests runs every file whatever the change reaches", async () => {
    const ran: (readonly string[])[] = [];

    await matrixCheck(ran).run(changed("docs/guide/x.md", true));

    expect(ran).toEqual([FILES]);
  });

  test("an unknown change runs the entire matrix conservatively", async () => {
    const ran: (readonly string[])[] = [];

    await matrixCheck(ran).run(changed("docs/guide/x.md"));

    expect(ran).toEqual([FILES]);
  });
});
