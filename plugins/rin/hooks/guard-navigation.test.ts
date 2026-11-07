import { describe, expect, test } from "vitest";
import {
  commandInvocationPayload,
  invokeBashHook,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-navigation.mjs";
const RUNTIME = "node";

const COMMAND_THIS_RAIL_MUST_STILL_DENY_WHEN_ALIVE =
  "cd packages/kernel && pnpm test";

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

describe("guard-navigation deny path", () => {
  test("blocks a leading cd then && chain with exit 2", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "cd packages/kernel && pnpm test",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
    expect(outcome.stderr).toContain("EnterWorktree");
  });

  test("blocks cd into an absolute Windows path", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "cd H:\\Development\\rin",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks git -C against another worktree", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git -C ../other-worktree status",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks re-cloning the rin monorepo", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git clone https://github.com/example/project fresh-rin",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks Set-Location into an absolute path", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "Set-Location /var/tmp",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks a git -C hidden behind a chaining operator", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "pnpm build && git -C ../other status",
      runtime: RUNTIME,
    });
    expect(outcome.exitCode).toBe(2);
  });

  test("blocks navigation issued through the PowerShell tool", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "PowerShell",
        command: "cd H:\\Development\\rin",
      }),
    });
    expect(outcome.exitCode).toBe(2);
  });
});

describe("guard-navigation pass-through path", () => {
  test("allows a bare command from cwd with exit 0", async () => {
    const result = await allowedWithLiveHookControl({
      command: "pnpm --filter @rin/kernel run test",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows git -c config override (not -C)", async () => {
    const result = await allowedWithLiveHookControl({
      command: "git -c core.hooksPath=/dev/null status",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a cd with no chaining operator", async () => {
    const result = await allowedWithLiveHookControl({
      command: "cd packages/kernel",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows a relative cd that the absolute-path rule must not match", async () => {
    const result = await allowedWithLiveHookControl({
      command: "cd packages/kernel/src",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("allows cloning a repository that is not rin", async () => {
    const result = await allowedWithLiveHookControl({
      command: "git clone https://github.com/example/other-project",
    });
    expect(result.allowed).toBe(true);
    expect(result.controlDenied).toBe(true);
  });

  test("ignores non-shell tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "Read",
        command: "cd /tmp && ls",
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
