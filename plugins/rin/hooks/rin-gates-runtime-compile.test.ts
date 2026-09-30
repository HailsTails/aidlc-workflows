import { afterEach, describe, expect, test, vi } from "vitest";
import {
  auditSyncPayload,
  engineHookInvocation,
  RIN_TRANSITION_WRAPPERS,
  run,
} from "./rin-gates-runtime-compile.ts";

const PROMOTE_COMMAND =
  'pnpm -s rin-gates:promote --task-id 019f9826-5ea2-7183-8c7a-0902aea51219 --label "kernel barrel split" --scope rin-gates';

const hookEventNameField = "hook_event_name";
const sessionIdField = "session_id";
const toolNameField = "tool_name";
const toolInputField = "tool_input";
const toolResponseField = "tool_response";
const exitCodeField = "exit_code";

const payload = JSON.stringify({
  [hookEventNameField]: "PostToolUse",
  [sessionIdField]: "session-1",
  cwd: "/workspace",
  [toolNameField]: "Bash",
  [toolInputField]: { command: PROMOTE_COMMAND, timeout: 30_000 },
  [toolResponseField]: { stdout: "Intent created", [exitCodeField]: 0 },
});

const compiledExecutableVariable = "AIDLC_COMPILED_EXECUTABLE";
const originalCompiledExecutable = process.env[compiledExecutableVariable];

afterEach(() => {
  if (originalCompiledExecutable === undefined) {
    delete process.env[compiledExecutableVariable];
  } else {
    process.env[compiledExecutableVariable] = originalCompiledExecutable;
  }
});

describe("auditSyncPayload", () => {
  test("preserves the promotion payload and adds the audit-sync source", () => {
    expect(JSON.parse(auditSyncPayload(payload) ?? "null")).toEqual({
      [hookEventNameField]: "PostToolUse",
      [sessionIdField]: "session-1",
      cwd: "/workspace",
      [toolNameField]: "Bash",
      [toolInputField]: {
        command: PROMOTE_COMMAND,
        timeout: 30_000,
        source: "audit-sync",
      },
      [toolResponseField]: { stdout: "Intent created", [exitCodeField]: 0 },
    });
  });

  test.each([
    ["malformed input", "{"],
    ["missing tool input", JSON.stringify({ [toolNameField]: "Bash" })],
    [
      "unrelated command",
      JSON.stringify({
        [toolInputField]: { command: "pnpm rin-gates:status" },
      }),
    ],
  ])("declines %s", (_label, input) => {
    expect(auditSyncPayload(input)).toBeNull();
  });
});

describe("run", () => {
  test("delegates the transformed promotion payload", () => {
    let dispatchedPayload: string | undefined;
    const dispatch = vi.fn((input: string) => {
      dispatchedPayload = input;
      return 0;
    });

    expect(run(payload, dispatch)).toBe(0);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(dispatchedPayload ?? "null")).toMatchObject({
      [sessionIdField]: "session-1",
      cwd: "/workspace",
      [toolInputField]: { command: PROMOTE_COMMAND, source: "audit-sync" },
    });
  });

  test("propagates a dispatcher failure", () => {
    expect(run(payload, () => 23)).toBe(23);
  });

  test("does not invoke the dispatcher for an unrelated command", () => {
    const dispatch = vi.fn(() => 0);

    expect(
      run(
        JSON.stringify({ [toolInputField]: { command: "pnpm test" } }),
        dispatch,
      ),
    ).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("engineHookInvocation", () => {
  test("uses the selected compiled executable and native hook route", () => {
    process.env[compiledExecutableVariable] = "/runtime/aidlc";

    expect(engineHookInvocation()).toEqual({
      executable: "/runtime/aidlc",
      arguments: ["engine", "hook", "rebuild-stage-graph"],
    });
  });

  test("uses the installed sibling dispatcher without a compiled executable", () => {
    delete process.env[compiledExecutableVariable];

    const invocation = engineHookInvocation();
    expect(invocation.executable).toBe(process.execPath);
    expect(invocation.arguments.slice(-3)).toEqual([
      "engine",
      "hook",
      "rebuild-stage-graph",
    ]);
    expect(invocation.arguments[0]).toMatch(
      /plugins[\\/]rin[\\/]tools[\\/]aidlc\.ts$/,
    );
  });
});

test("matches only the promotion wrapper", () => {
  expect(RIN_TRANSITION_WRAPPERS.test(PROMOTE_COMMAND)).toBe(true);
  expect(RIN_TRANSITION_WRAPPERS.test("pnpm -s rin-gates:status")).toBe(false);
});
