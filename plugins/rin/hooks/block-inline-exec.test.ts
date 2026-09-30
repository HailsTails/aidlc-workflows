import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  commandInvocationPayload,
  invokeBashHook,
  permissionDecisionFrom,
  runRanHookProcess,
} from "./run-hook-process.ts";

const HOOK = "block-inline-exec.ts";
const RUNTIME = "bun";

const denialFor = async ({ command }: { readonly command: string }) => {
  const outcome = await invokeBashHook({
    hookFileName: HOOK,
    command,
    runtime: RUNTIME,
  });
  return permissionDecisionFrom({ stdout: outcome.stdout });
};

describe("block-inline-exec deny path", () => {
  test("denies node -e inline evaluation", async () => {
    const decision = await denialFor({ command: 'node -e "console.log(1)"' });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies python -c inline evaluation", async () => {
    const decision = await denialFor({ command: "python3 -c 'print(1)'" });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies an ad-hoc bash -c script", async () => {
    const decision = await denialFor({ command: 'bash -c "rm -rf x"' });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies piping output into an interpreter", async () => {
    const decision = await denialFor({ command: "cat file | node" });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("block-inline-exec per-segment evaluation", () => {
  test("denies a node -e tail even behind an allowlisted pnpm head", async () => {
    const decision = await denialFor({
      command: 'pnpm install ; node -e "process.exit(0)"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a node -e tail joined with && to an allowlisted head", async () => {
    const decision = await denialFor({
      command: 'pnpm run build && node -e "1"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies an ad-hoc script tail behind an allowlisted head", async () => {
    const decision = await denialFor({
      command: "pnpm install && bash scripts/sketchy.sh",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a node script tail piped behind an allowlisted head", async () => {
    const decision = await denialFor({
      command: "pnpm run build ; node throwaway.mjs",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a bash -c tail behind an allowlisted head", async () => {
    const decision = await denialFor({
      command: 'pnpm exec tsx x.ts && bash -c "rm -rf y"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("block-inline-exec authorised locations", () => {
  const passesFor = async ({ command }: { readonly command: string }) => {
    const projectDir = mkdtempSync(join(tmpdir(), "rin-inline-exec-"));
    const hooksDir = join(projectDir, ".claude", "hooks");
    const manifestDir = join(projectDir, ".constitution-authorised-locations");
    mkdirSync(hooksDir, { recursive: true });
    mkdirSync(manifestDir, { recursive: true });
    const hookPath = join(hooksDir, HOOK);
    copyFileSync(join(dirname(fileURLToPath(import.meta.url)), HOOK), hookPath);
    writeFileSync(
      join(manifestDir, "inline-exec.json"),
      JSON.stringify([{ pathPrefixes: ["scripts/", ".aidlc/tools/", ".aidlc/rin-gates/"] }]),
    );
    try {
      const outcome = await invokeBashHook({
        hookFileName: HOOK,
        hookPath,
        command,
        runtime: RUNTIME,
      });
      return permissionDecisionFrom({ stdout: outcome.stdout });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  };

  test("allows a python script committed under scripts/", async () => {
    const decision = await passesFor({
      command: "python3 scripts/tasks/migrate.py --db x.db",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows a node script committed under scripts/", async () => {
    const decision = await passesFor({
      command: "node scripts/harness/probe.mjs",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows an authorised script reached through $CLAUDE_PROJECT_DIR", async () => {
    const decision = await passesFor({
      command: "python3 $CLAUDE_PROJECT_DIR/scripts/checks/verify.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows an authorised script reached through $AIDLC_PROJECT_DIR", async () => {
    const decision = await passesFor({
      command: "python3 $AIDLC_PROJECT_DIR/scripts/checks/verify.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows an allowlisted runner under $AIDLC_PROJECT_DIR", async () => {
    const decision = await passesFor({
      command: "bun $AIDLC_PROJECT_DIR/.aidlc/tools/aidlc-orchestrate.ts next",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("still denies inline code behind an $AIDLC_PROJECT_DIR authorised path", async () => {
    const decision = await denialFor({
      command:
        'python3 $AIDLC_PROJECT_DIR/scripts/checks/verify.py -c "print(1)"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("still denies python -c inline code even at an authorised path", async () => {
    const decision = await denialFor({
      command: "python3 -c \"import os; print(os.listdir('scripts'))\"",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("still denies node -e inline code naming an authorised path", async () => {
    const decision = await denialFor({
      command: "node -e \"require('./scripts/x.js')\"",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a script at an undeclared path", async () => {
    const decision = await denialFor({
      command: "python3 /tmp/throwaway.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a script in the Claude guard directory, which is deliberately not authorised", async () => {
    const decision = await denialFor({
      command: "python3 .claude/hooks/written-then-run.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a non-bun interpreter in the .aidlc guard directory", async () => {
    const decision = await denialFor({
      command: "python3 .aidlc/hooks/written-then-run.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  // PINS PRE-EXISTING BEHAVIOUR, not something this seam introduced. The legacy
  // allowlistedRunnerPattern admits `bun .aidlc/hooks/` and is evaluated BEFORE
  // the authorised-location check, so this one shape still passes. This manifest
  // declares no guard directory, so it does not widen that allowance to the other
  // six interpreters — but it does not narrow the existing bun one either, which
  // would be a behaviour change outside this Slice. Tracked as 01a05153.
  test("the legacy bun runner allowance into .aidlc/hooks is unchanged by this seam", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "bun .aidlc/hooks/existing-tool.ts",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("denies a bare .aidlc scratch path outside its authorised subdirectories", async () => {
    const decision = await denialFor({
      command: "bun .aidlc/scratch/throwaway.ts",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("allows a script under an authorised .aidlc subdirectory", async () => {
    const decision = await passesFor({
      command: "bun .aidlc/tools/report.ts",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("denies a script in a sibling directory that merely starts with the prefix text", async () => {
    const decision = await denialFor({
      command: "python3 scripts-untrusted/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a traversal escaping an authorised prefix", async () => {
    const decision = await denialFor({
      command: "python3 scripts/../../outside/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a single-dotdot traversal that leaves the authorised root", async () => {
    const decision = await denialFor({
      command: "python3 scripts/../outside/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a mid-path traversal that re-enters under the prefix name", async () => {
    const decision = await denialFor({
      command: "python3 scripts/../outside/../scripts-untrusted/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a leading traversal above the repository root", async () => {
    const decision = await denialFor({
      command: "python3 ../scripts/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies a backslash-spelled traversal escaping an authorised prefix", async () => {
    const decision = await denialFor({
      command: "python3 scripts\\..\\outside\\evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("allows a script one level under a two-segment authorised prefix", async () => {
    const decision = await passesFor({
      command: "bun .aidlc/rin-gates/report.ts",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("denies a segment that merely begins with dots rather than being a traversal", async () => {
    const decision = await denialFor({
      command: "python3 ..foo/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies an unauthorised script tail behind an authorised head", async () => {
    const decision = await denialFor({
      command: "python3 scripts/checks/ok.py && python3 /tmp/evil.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("denies an inline eval tail behind an authorised head", async () => {
    const decision = await denialFor({
      command: 'python3 scripts/checks/ok.py ; node -e "process.exit(0)"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("allows an authorised script invoked as an ssh tail", async () => {
    const decision = await passesFor({
      command: "ssh host python3 scripts/tasks/migrate.py",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("still denies piping into an interpreter at an authorised path", async () => {
    const decision = await denialFor({
      command: "cat scripts/checks/ok.py | python3",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("still denies a heredoc-fed interpreter naming an authorised path", async () => {
    const decision = await denialFor({
      command: "python3 <<'EOF'\nprint('scripts/x.py')\nEOF",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });
});

describe("block-inline-exec pass-through path", () => {
  test("allows a bare allowlisted pnpm command with exit 0", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "pnpm exec vitest run",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("allows running a committed script via pnpm exec tsx", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "pnpm exec tsx scripts/audit-constitution.ts",
      runtime: RUNTIME,
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("blocks a retired Spec-Kit bash script (allowance removed with Spec-Kit)", async () => {
    const decision = await denialFor({
      command:
        "SPECIFY_FEATURE=081-kernel-bind-host bash .specify/scripts/bash/check-prerequisites.sh --json",
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("a leading env assignment does not launder a denied inline eval", async () => {
    const decision = await denialFor({
      command: 'FOO=bar node -e "process.exit(0)"',
    });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
  });

  test("allows a plain git command", async () => {
    const outcome = await invokeBashHook({
      hookFileName: HOOK,
      command: "git status --porcelain",
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
        command: "node -e 1",
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("exits without a decision when tool_input is not an object", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: "node -e 1",
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("exits without a decision when command is not a string", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        tool_input: { command: ["node", "-e", "1"] },
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
  });

  test("still denies an inline eval when the payload carries extra unknown keys", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      stdinPayload: JSON.stringify({
        tool_name: "Bash",
        session_id: "s-1",
        tool_input: { command: "node -e 1", timeout: 5000 },
      }),
    });
    const decision = permissionDecisionFrom({ stdout: outcome.stdout });
    expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
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
