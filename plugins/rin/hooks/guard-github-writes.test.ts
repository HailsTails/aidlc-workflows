import { describe, expect, test } from "vitest";
import {
  commandInvocationPayload,
  invokeBashHook,
  permissionDecisionFrom,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-github-writes.mjs";
const RUNTIME = "node";

describe("guard-github-writes deny path", () => {
  test("denies raw gh pr create via permissionDecision", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'gh pr create --title "x" --body "y"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:pr",
    );
  });

  test("denies raw gh pr edit and names the gh:pr-edit wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'gh pr edit 42 --body "y"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:pr-edit",
    );
  });

  test("denies raw gh pr review", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr review 42 --approve",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies raw gh issue comment", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'gh issue comment 42 --body "x"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:comment",
    );
  });

  test("denies raw gh pr merge", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr merge 42 --squash",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:merge",
    );
  });

  test("denies a mutating gh api call", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh api -X POST repos/example/project/issues",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies raw gh pr close and names the gh:close wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr close 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:close",
    );
  });

  test("denies gh pr ready --undo and names the gh:draft wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr ready 42 --undo",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:draft",
    );
  });

  test("denies plain gh pr ready and names the gh:ready wrapper", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr ready 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "pnpm gh:ready",
    );
  });

  test("denies gh pr create chained after another command", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git push && gh pr create --fill",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("guard-github-writes pass-through path", () => {
  test("allows read-only gh pr view with no deny decision", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr view 42",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a read-only gh api GET", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh api installation/repositories",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a gh api call whose method is a read verb", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh api -X GET repos/example/project/pulls",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows gh pr list, a near-miss on the pr write verbs", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "gh pr list --state open",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows the gh:pr wrapper that the deny reason recommends", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: 'pnpm gh:pr -- --title "x" --body "y"',
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows plain git push", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git push",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("ignores non-Bash tools", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: commandInvocationPayload({
        toolName: "Read",
        command: "gh pr create",
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("exits without a decision on empty stdin", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: "",
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("treats a Bash payload with no command as an empty command", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({ tool_name: "Bash", tool_input: {} }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });
});
