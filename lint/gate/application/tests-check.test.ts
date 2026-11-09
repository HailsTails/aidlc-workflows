import { describe, expect, test } from "bun:test";
import type { GateScope } from "./gate-scope.ts";
import type { CommandResult, Workspace } from "./ports.ts";
import { testsCheck, type TestSuite } from "./tests-check.ts";

const SCOPE: GateScope = {
  lane: undefined,
  base: undefined,
  changes: [],
  everything: true,
  build: false,
  record: false,
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
}) =>
  testsCheck({
    runner: { capture: () => request.result, attach: () => 0 },
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
