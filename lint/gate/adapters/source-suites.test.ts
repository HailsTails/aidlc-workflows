import { describe, expect, test } from "bun:test";
import { testsCheck } from "../application/tests-check.ts";
import type { GateScope } from "../application/gate-scope.ts";
import type { Command } from "../application/ports.ts";
import { sourceSuites } from "./source-suites.ts";

const BUN = "bun";
const HOST_TEST = "src/hosts/claude/projection/agent.test.ts";

const hostOnlyChange: GateScope = {
  lane: undefined,
  base: undefined,
  changes: [{ path: "src/hosts/claude/projection/agent.ts", kind: "modified" }],
  everything: false,
  build: false,
  record: false,
  allTests: false,
  heavy: { ensure: async () => ({ acquired: true }) },
};

type Session = { readonly ran: Command[]; readonly check: ReturnType<typeof testsCheck> };

const session = (sourceRun: { exitCode: number; output: string }): Session => {
  const ran: Command[] = [];
  const check = testsCheck({
    runner: {
      capture: (command) => {
        ran.push(command);
        return sourceRun;
      },
      captureAll: async () => [],
      attach: () => 0,
    },
    workspace: {
      read: () => undefined,
      write: () => undefined,
      filesMatching: (globs) => (globs.includes("src/**/*.test.ts") ? [HOST_TEST] : []),
    },
    suites: sourceSuites(BUN),
    looseTests: [],
    capabilities: { probe: () => ({ available: true, evidence: "present" }) },
    exclusions: [],
    build: { ensure: () => undefined },
    reachOf: () => ({}),
    testCommand: (files) => ({ label: "bun test", argv: [BUN, "test", ...files] }),
  });
  return { ran, check };
};

describe("the source suite", () => {
  test("a change in one host runs the whole source tree as bun test ./src", async () => {
    const run = session({ exitCode: 0, output: "" });

    const outcome = await run.check.run(hostOnlyChange);

    expect(outcome).toMatchObject({ status: "green" });
    expect(run.ran.map((command) => command.argv)).toEqual([[BUN, "test", "./src"]]);
  });

  test("a red source test turns the check red", async () => {
    const run = session({ exitCode: 1, output: "1 fail" });

    const outcome = await run.check.run(hostOnlyChange);

    expect(outcome).toMatchObject({ status: "red" });
  });
});
