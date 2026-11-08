import { describe, expect, test } from "bun:test";
import { testsCheck } from "../application/tests-check.ts";
import type { GateScope } from "../application/gate-scope.ts";
import { SOURCE_SUITES } from "./source-suites.ts";

const HOST_TEST = "src/hosts/claude/projection/agent.test.ts";

const hostOnlyChange: GateScope = {
  lane: undefined,
  base: undefined,
  changes: [{ path: "src/hosts/claude/projection/agent.ts", kind: "modified" }],
  everything: false,
  build: false,
  record: false,
};

const ranFiles: string[][] = [];

const check = testsCheck({
  runner: {
    capture: () => ({ exitCode: 0, output: "" }),
    attach: () => 0,
  },
  workspace: {
    read: () => undefined,
    write: () => undefined,
    filesMatching: (globs) => (globs.includes("src/hosts/claude/**/*.test.ts") ? [HOST_TEST] : []),
  },
  suites: SOURCE_SUITES,
  looseTests: [],
  capabilities: { probe: () => ({ available: true, evidence: "present" }) },
  exclusions: [],
  testCommand: (files) => {
    ranFiles.push([...files]);
    return { label: "bun test", argv: ["test", ...files] };
  },
});

describe("SOURCE_SUITES", () => {
  test("a change in one host runs that host's tests", async () => {
    const outcome = await check.run(hostOnlyChange);

    expect(outcome).toMatchObject({ status: "green", note: "src/hosts/claude (1)" });
    expect(ranFiles).toEqual([[HOST_TEST]]);
  });
});
