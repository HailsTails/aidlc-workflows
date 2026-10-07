import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import {
  bashInvocationPayload,
  permissionDecisionFrom,
  runRanHookProcess,
} from "./run-hook-process.ts";

const hooksDirectory = dirname(fileURLToPath(import.meta.url));
const RUNTIME = "node";
const INLINE_EXEC_HOOK = "block-inline-exec.ts";
const INLINE_EXEC_RUNTIME = "bun";

const mutantRoots: string[] = [];

type Mutant = {
  readonly path: string;
  readonly anchorFound: boolean;
  readonly textChanged: boolean;
};

const mutantOf = (input: {
  readonly hookFileName: string;
  readonly find: string;
  readonly replace: string;
}): Mutant => {
  const root = mkdtempSync(join(tmpdir(), "hook-mutant-"));
  mutantRoots.push(root);
  const mutantPath = join(root, input.hookFileName);
  copyFileSync(join(hooksDirectory, input.hookFileName), mutantPath);
  const original = readFileSync(mutantPath, "utf8");
  const mutated = original.replace(input.find, input.replace);
  writeFileSync(mutantPath, mutated);
  return {
    path: mutantPath,
    anchorFound: original.includes(input.find),
    textChanged: mutated !== original,
  };
};

const denyDecisionFrom = (stdout: string): boolean =>
  permissionDecisionFrom({ stdout }).hookSpecificOutput?.permissionDecision ===
  "deny";

afterEach(() => {
  mutantRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("mutant detection — the suites fail against a weakened rail", () => {
  test("the original inline-exec rail denies an inline eval", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: INLINE_EXEC_HOOK,
      runtime: INLINE_EXEC_RUNTIME,
      stdinPayload: bashInvocationPayload({
        command: 'node -e "console.log(1)"',
      }),
    });
    expect(denyDecisionFrom(outcome.stdout)).toBe(true);
  });

  test("an inline-exec mutant with its eval rule removed stops denying", async () => {
    const mutant = mutantOf({
      hookFileName: INLINE_EXEC_HOOK,
      find: "if (inlineEvalRule.test(segment)) return true;",
      replace: "if (false) return true;",
    });
    expect(mutant.anchorFound).toBe(true);
    expect(mutant.textChanged).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: INLINE_EXEC_HOOK,
      hookPath: mutant.path,
      runtime: INLINE_EXEC_RUNTIME,
      stdinPayload: bashInvocationPayload({
        command: 'node -e "console.log(1)"',
      }),
    });
    expect(denyDecisionFrom(outcome.stdout)).toBe(false);
  });

  test("the original github-writes rail denies a raw gh pr create", async () => {
    const outcome = await runRanHookProcess({
      hookFileName: "guard-github-writes.mjs",
      runtime: RUNTIME,
      stdinPayload: bashInvocationPayload({ command: "gh pr create --fill" }),
    });
    expect(denyDecisionFrom(outcome.stdout)).toBe(true);
  });

  test("a github-writes mutant with its create rule widened stops denying", async () => {
    const mutant = mutantOf({
      hookFileName: "guard-github-writes.mjs",
      find: 'tail: "gh\\\\s+pr\\\\s+create\\\\b"',
      replace: 'tail: "gh\\\\s+pr\\\\s+create-nothing\\\\b"',
    });
    expect(mutant.anchorFound).toBe(true);
    expect(mutant.textChanged).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: "guard-github-writes.mjs",
      hookPath: mutant.path,
      runtime: RUNTIME,
      stdinPayload: bashInvocationPayload({ command: "gh pr create --fill" }),
    });
    expect(denyDecisionFrom(outcome.stdout)).toBe(false);
  });

  test("hookPath spawns the copy rather than the original hook", async () => {
    const mutant = mutantOf({
      hookFileName: INLINE_EXEC_HOOK,
      find: "IS THIS REALLY JUST A SEARCH?",
      replace: "SENTINEL-ONLY-IN-THE-COPY",
    });
    expect(mutant.anchorFound).toBe(true);
    expect(mutant.textChanged).toBe(true);
    const outcome = await runRanHookProcess({
      hookFileName: INLINE_EXEC_HOOK,
      hookPath: mutant.path,
      runtime: INLINE_EXEC_RUNTIME,
      stdinPayload: bashInvocationPayload({
        command: 'node -e "console.log(1)"',
      }),
    });
    expect(outcome.stdout).toContain("SENTINEL-ONLY-IN-THE-COPY");
  });
});
