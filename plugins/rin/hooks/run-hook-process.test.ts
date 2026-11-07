import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  agentInvocationPayload,
  bashInvocationPayload,
  enterWorktreePayload,
  fileInvocationPayload,
  gateRunPayload,
  runHookProcess,
  runRanHookProcess,
  sessionStartPayload,
  subagentStopPayload,
  transcriptPayload,
} from "./run-hook-process.ts";

const RUNTIME = "node";

const scratchRoots: string[] = [];

const scratchHook = ({
  hookSource,
}: {
  readonly hookSource: string;
}): string => {
  const root = mkdtempSync(join(tmpdir(), "run-hook-process-"));
  scratchRoots.push(root);
  const hookPath = join(root, "hook.mjs");
  writeFileSync(hookPath, hookSource, "utf8");
  return hookPath;
};

afterEach(() => {
  scratchRoots.splice(0).forEach((root) => {
    rmSync(root, { force: true, recursive: true });
  });
});

describe("hook wire payloads", () => {
  test("a Bash invocation carries the tool name and command under the wire names", () => {
    expect(bashInvocationPayload({ command: "ls" })).toBe(
      '{"tool_name":"Bash","tool_input":{"command":"ls"}}',
    );
  });

  test("a file invocation names the file path on the wire", () => {
    expect(
      fileInvocationPayload({ toolName: "Edit", filePath: "/repo/a.ts" }),
    ).toBe('{"tool_name":"Edit","tool_input":{"file_path":"/repo/a.ts"}}');
  });

  test("an agent invocation names the subagent type and team on the wire", () => {
    expect(
      agentInvocationPayload({
        toolName: "Agent",
        subagentType: "lens",
        teamName: "board",
      }),
    ).toBe(
      '{"tool_name":"Agent","tool_input":{"subagent_type":"lens","team_name":"board"}}',
    );
  });

  test("a gate run carries the tool response's stdout and exit code", () => {
    expect(
      gateRunPayload({ cwd: "/repo", command: "pnpm test", output: "ok" }),
    ).toBe(
      '{"tool_name":"Bash","tool_input":{"command":"pnpm test"},"tool_response":{"stdout":"ok","exit_code":0},"cwd":"/repo"}',
    );
  });

  test("an EnterWorktree invocation carries the path", () => {
    expect(enterWorktreePayload({ worktreePath: "/wt" })).toBe(
      '{"tool_name":"EnterWorktree","tool_input":{"path":"/wt"}}',
    );
  });

  test("an EnterWorktree invocation carries the cwd when one is given", () => {
    expect(enterWorktreePayload({ worktreePath: "/wt", cwd: "/repo" })).toBe(
      '{"tool_name":"EnterWorktree","tool_input":{"path":"/wt"},"cwd":"/repo"}',
    );
  });

  test("a SubagentStop payload carries the agent type, last message, cwd and session", () => {
    expect(
      subagentStopPayload({
        agentType: "rin-naming-reviewer-agent",
        lastAssistantMessage: "READY",
        cwd: "/repo",
        sessionId: "s-1",
      }),
    ).toBe(
      '{"agent_type":"rin-naming-reviewer-agent","last_assistant_message":"READY","cwd":"/repo","session_id":"s-1"}',
    );
  });

  test("a SessionStart payload names the hook event", () => {
    expect(sessionStartPayload({ cwd: "/repo" })).toBe(
      '{"hook_event_name":"SessionStart","cwd":"/repo"}',
    );
  });

  test("a SessionStart payload with no cwd carries only the hook event", () => {
    expect(sessionStartPayload()).toBe('{"hook_event_name":"SessionStart"}');
  });

  test("a transcript-bearing payload carries the cwd when one is given", () => {
    expect(
      transcriptPayload({
        hookEventName: "Stop",
        transcriptPath: "/t.jsonl",
        cwd: "/repo",
      }),
    ).toBe(
      '{"hook_event_name":"Stop","transcript_path":"/t.jsonl","cwd":"/repo"}',
    );
  });

  test("a transcript-bearing payload with no transcript path carries only the event", () => {
    expect(transcriptPayload({ hookEventName: "Stop" })).toBe(
      '{"hook_event_name":"Stop"}',
    );
  });

  test("a transcript-bearing payload names the event and transcript path", () => {
    expect(
      transcriptPayload({
        hookEventName: "PostToolUse",
        transcriptPath: "/t.jsonl",
      }),
    ).toBe('{"hook_event_name":"PostToolUse","transcript_path":"/t.jsonl"}');
  });
});

describe("runHookProcess outcome discrimination", () => {
  test("a hook that exits 0 is reported as ran with exitCode 0", async () => {
    const hookPath = scratchHook({ hookSource: "process.exit(0);" });

    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome.kind).toBe("ran");
    expect(outcome).toMatchObject({ exitCode: 0, signal: null });
  });

  test("a hook that exits 2 is reported as ran with exitCode 2", async () => {
    const hookPath = scratchHook({ hookSource: "process.exit(2);" });

    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome).toMatchObject({ kind: "ran", exitCode: 2, signal: null });
  });

  test("an unspawnable child resolves to spawnFailed rather than rejecting", async () => {
    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath: scratchHook({ hookSource: "process.exit(0);" }),
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      cwd: join(tmpdir(), "run-hook-process-absent-cwd"),
      runtime: RUNTIME,
    });

    expect(outcome.kind).toBe("spawnFailed");
  });

  test("an unspawnable child is never mistaken for an allowing hook", async () => {
    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath: scratchHook({ hookSource: "process.exit(0);" }),
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      cwd: join(tmpdir(), "run-hook-process-absent-cwd"),
      runtime: RUNTIME,
    });

    expect(outcome).not.toMatchObject({ exitCode: 0 });
  });

  test("a hook whose script is missing exits non-zero rather than spawn-failing", async () => {
    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath: join(tmpdir(), "run-hook-process-absent", "hook.mjs"),
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome.kind).toBe("ran");
    expect(outcome).not.toMatchObject({ exitCode: 0 });
  });

  test("the signal field reports null for a hook that exited on its own", async () => {
    const hookPath = scratchHook({ hookSource: "process.exit(0);" });

    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome).toMatchObject({ kind: "ran", signal: null });
  });

  test("a hook killed before it could decide is not reported as exit 0", async () => {
    const hookPath = scratchHook({
      hookSource:
        "process.kill(process.pid, 'SIGKILL');\nsetTimeout(() => {}, 10_000);",
    });

    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome.kind).toBe("ran");
    expect(outcome).not.toMatchObject({ exitCode: 0 });
  });

  test("runRanHookProcess hands consumers the ran arm directly", async () => {
    const hookPath = scratchHook({ hookSource: "process.exit(2);" });

    const outcome = await runRanHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome.exitCode).toBe(2);
  });

  test("runRanHookProcess fails the fixture rather than yielding a spawn failure to assertions", async () => {
    await expect(
      runRanHookProcess({
        hookFileName: "hook.mjs",
        hookPath: scratchHook({ hookSource: "process.exit(0);" }),
        stdinPayload: bashInvocationPayload({ command: "ls" }),
        cwd: join(tmpdir(), "run-hook-process-absent-cwd"),
        runtime: RUNTIME,
      }),
    ).rejects.toThrow("hook process never ran");
  });

  test("stdout and stderr are captured on a hook that wrote to both", async () => {
    const hookPath = scratchHook({
      hookSource:
        "process.stdout.write('out');\nprocess.stderr.write('err');\nprocess.exit(0);",
    });

    const outcome = await runHookProcess({
      hookFileName: "hook.mjs",
      hookPath,
      stdinPayload: bashInvocationPayload({ command: "ls" }),
      runtime: RUNTIME,
    });

    expect(outcome).toMatchObject({ stdout: "out", stderr: "err" });
  });
});
