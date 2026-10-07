import { describe, expect, test } from "vitest";
import {
  commandInvocationPayload,
  invokeBashHook,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-shell-syntax.mjs";
const RUNTIME = "node";

const COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE =
  "git commit -m @'multi\nline'";

const allowedWithLiveHookControl = async ({
  command,
}: {
  readonly command: string;
}): Promise<{ readonly allowed: boolean; readonly controlDenied: boolean }> => {
  const allowOutcome = await invokeBashHook({
    hookFileName: HOOK,
    command,
    runtime: RUNTIME,
  });
  const controlOutcome = await invokeBashHook({
    hookFileName: HOOK,
    command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
    runtime: RUNTIME,
  });
  return {
    allowed: allowOutcome.exitCode === 0 && allowOutcome.stderr === "",
    controlDenied: controlOutcome.exitCode === 2,
  };
};

describe("guard-shell-syntax deny path", () => {
  test("blocks git commit -m with a PowerShell here-string opener", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git commit -m @'multi\nline'",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("here-string");
  });

  test("blocks a double-quoted here-string opener", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'git commit -m @"multi\nline"',
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks a here-string closer on its own line", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "echo start\n'@\necho end",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks a double-quoted here-string closer on its own line", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'echo start\n"@\necho end',
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });
});

describe("guard-shell-syntax pass-through path", () => {
  test("allows a normal quoted commit message with exit 0", async () => {
    const result = await allowedWithLiveHookControl({
      command: 'git commit -m "feat(x): a normal message"',
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows commit via a file with -F", async () => {
    const result = await allowedWithLiveHookControl({
      command: "git commit -F /tmp/message.txt",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows an at-sign closer that is not alone on its line", async () => {
    const result = await allowedWithLiveHookControl({
      command: 'echo "trailing \'@ inside a line"',
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a commit message mentioning an at-sign without a quote", async () => {
    const result = await allowedWithLiveHookControl({
      command: 'git commit -m "bump @rin/kernel"',
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("ignores non-Bash tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "git commit -m @'x'",
      }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("exits without denying on empty stdin", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: "",
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });

  test("treats a Bash payload with no command as an empty command", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({ tool_name: "Bash", tool_input: {} }),
    });
    const control = await invokeBashHook({
      hookFileName: HOOK,
      command: COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE,
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(0);
    expect(control.exitCode).toBe(2);
  });
});
