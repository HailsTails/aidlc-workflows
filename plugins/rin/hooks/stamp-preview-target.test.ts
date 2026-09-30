import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  enterWorktreePayload,
  runRanHookProcess,
  sessionStartPayload,
} from "./run-hook-process.ts";

const HOOK = "stamp-preview-target.mjs";
const RUNTIME = "node";

const createdRoots: string[] = [];

const tempDir = ({ prefix }: { readonly prefix: string }) => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
};

afterEach(() => {
  createdRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("stamp-preview-target non-worktree path", () => {
  test("exits 0 without writing a registry when cwd is not a worktree root", async () => {
    const cwd = tempDir({ prefix: "stamp-plain-" });
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      cwd,
      stdinPayload: sessionStartPayload(),
    });
    expect(outcome.exitCode).toBe(0);
    expect(readdirSync(cwd)).toEqual([]);
  });

  test("exits 0 when the tool_input path is not a worktree root", async () => {
    const cwd = tempDir({ prefix: "stamp-nonworktree-" });
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      cwd,
      stdinPayload: enterWorktreePayload({
        worktreePath: "/nonexistent/worktree",
      }),
    });
    expect(outcome.exitCode).toBe(0);
  });

  test("exits 0 on malformed stdin without throwing", async () => {
    const cwd = tempDir({ prefix: "stamp-malformed-" });
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      cwd,
      stdinPayload: "not json at all",
    });
    expect(outcome.exitCode).toBe(0);
  });
});
