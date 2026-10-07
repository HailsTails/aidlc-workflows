import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { afterEach, describe, expect, test } from "vitest";
import {
  permissionDecisionFrom,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "guard-primary-commit.mjs";
const RUNTIME = "node";

const INHERITED_ENVIRONMENT_KEYS = ["PATH", "SYSTEMROOT"] as const;

const gitScrubbedEnvironment = (): Readonly<Record<string, string>> =>
  Object.fromEntries(
    INHERITED_ENVIRONMENT_KEYS.map((key) => [key, env[key] ?? ""]),
  );

const fixtureRoots: string[] = [];

const topologyFixture = (): {
  readonly primary: string;
  readonly worktree: string;
} => {
  const parent = mkdtempSync(join(tmpdir(), "guard-primary-commit-"));
  fixtureRoots.push(parent);
  const primary = join(parent, "primary");
  const worktree = join(parent, "worktree");
  mkdirSync(join(primary, ".git", "worktrees", "wt"), { recursive: true });
  mkdirSync(worktree, { recursive: true });
  writeFileSync(
    join(worktree, ".git"),
    `gitdir: ${join(primary, ".git", "worktrees", "wt").replace(/\\/g, "/")}\n`,
  );
  return { primary, worktree };
};

const commitAt = (cwd: string): Promise<{ readonly stdout: string }> =>
  runRanHookProcess({
    hookFileName: HOOK,
    runtime: RUNTIME,
    env: gitScrubbedEnvironment(),
    stdinPayload: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: 'git commit -m "x"' },
      cwd,
    }),
  });

afterEach(() => {
  fixtureRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("guard-primary-commit deny path", () => {
  test("denies a commit issued at the primary checkout", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await commitAt(primary);
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("names the EnterWorktree remedy in the deny reason", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await commitAt(primary);
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecisionReason).toContain(
      "EnterWorktree",
    );
  });

  test("denies a commit chained behind another command at the primary", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: 'git add -A && git commit -m "x"' },
        cwd: primary,
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a commit carrying git -c config flags at the primary", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: 'git -c user.name=x commit -m "y"' },
        cwd: primary,
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("guard-primary-commit pass-through path", () => {
  test("allows a commit issued from a linked worktree", async () => {
    const { primary, worktree } = topologyFixture();
    expect(statSync(join(worktree, ".git")).isFile()).toBe(true);
    expect(
      statSync(join(primary, ".git", "worktrees", "wt")).isDirectory(),
    ).toBe(true);
    const outcome = await commitAt(worktree);
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a non-commit git command at the primary", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "git status --porcelain" },
        cwd: primary,
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a command that merely mentions commit at the primary", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: "echo git commit" },
        cwd: primary,
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("ignores a non-Bash tool whose payload cwd is the primary", async () => {
    const { primary } = topologyFixture();
    expect(statSync(join(primary, ".git")).isDirectory()).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({
        tool_name: "Read",
        tool_input: { command: 'git commit -m "x"' },
        cwd: primary,
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("exits without a decision on empty stdin", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: "",
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("treats a Bash payload with no command as an empty command", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      env: gitScrubbedEnvironment(),
      stdinPayload: JSON.stringify({ tool_name: "Bash", tool_input: {} }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });
});
