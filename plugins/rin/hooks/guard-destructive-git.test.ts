import { describe, expect, test } from "vitest";
import {
  invokeBashHook,
  invokeFileHook,
  permissionDecisionFrom,
} from "./run-hook-process.ts";

const HOOK = "guard-destructive-git.mjs";
const RUNTIME = "node";

const decisionFor = async ({ command }: { readonly command: string }) => {
  const outcome = await invokeBashHook({
    hookFileName: HOOK,
    command,
    runtime: RUNTIME,
  });
  return permissionDecisionFrom({ stdout: outcome.stdout });
};

describe("guard-destructive-git deny path", () => {
  const deniedCommands = [
    "git push --force origin main",
    "git push -f origin main",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git branch -D feature",
    "rm -rf build",
    "rm -fr build",
    "echo hi && git push --force origin main",
    "cat file && rm -rf build",
  ];

  deniedCommands.forEach((command) => {
    test(`denies: ${command}`, async () => {
      const decision = await decisionFor({ command });
      expect(decision.hookSpecificOutput?.permissionDecision).toBe("deny");
    });
  });
});

describe("guard-destructive-git allow path", () => {
  const allowedCommands = [
    "git push --force-with-lease origin main",
    "git push origin main",
    "git push origin claude/lane-f",
    "git push -u origin claude/lane-f",
    "git push origin feature/pdf",
    "git reset HEAD~1",
    "git clean -n",
    "git branch -d feature",
    "git status",
    "rm build/artifact.txt",
    "echo 'do not rm -rf anything'",
  ];

  allowedCommands.forEach((command) => {
    test(`allows: ${command}`, async () => {
      const decision = await decisionFor({ command });
      expect(decision.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });
});

describe("guard-destructive-git scope", () => {
  test("ignores non-Bash tools", async () => {
    const outcome = await invokeFileHook({
      hookFileName: HOOK,
      toolName: "Edit",
      filePath: "packages/rm -rf/notes.md",
      runtime: RUNTIME,
    });
    expect(
      permissionDecisionFrom({ stdout: outcome.stdout }).hookSpecificOutput
        ?.permissionDecision,
    ).toBeUndefined();
  });
});
