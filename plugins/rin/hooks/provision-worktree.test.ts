import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  compileRuntimeGraph,
  isWorktreeRoot,
  needsProvisioning,
  sessionDirectoryFrom,
} from "./provision-worktree.mjs";
import {
  enterWorktreePayload,
  runRanHookProcess,
  sessionStartPayload,
} from "./run-hook-process.ts";

const HOOK = "provision-worktree.mjs";
const RUNTIME = "node";

const SQLITE_BINDING_RELATIVE_DIR = join(
  "node_modules",
  ".pnpm",
  "better-sqlite3@11.5.0",
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
);

const createdRoots: string[] = [];

const tempDir = ({ prefix }: { readonly prefix: string }) => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
};

const makeWorktree = ({ prefix }: { readonly prefix: string }) => {
  const root = tempDir({ prefix });
  writeFileSync(join(root, ".git"), "gitdir: /nonexistent/worktree\n");
  return root;
};

const writeSqliteBinding = ({ worktree }: { readonly worktree: string }) => {
  const bindingDir = join(worktree, SQLITE_BINDING_RELATIVE_DIR);
  mkdirSync(bindingDir, { recursive: true });
  writeFileSync(join(bindingDir, "better_sqlite3.node"), "");
};

afterEach(() => {
  createdRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("sessionDirectoryFrom", () => {
  test("returns the payload cwd when present", () => {
    const directory = sessionDirectoryFrom({
      payload: sessionStartPayload({ cwd: "/payload/worktree" }),
      fallbackDirectory: "/process/cwd",
    });
    expect(directory).toBe("/payload/worktree");
  });

  test("returns the EnterWorktree tool_input path when present", () => {
    const directory = sessionDirectoryFrom({
      payload: enterWorktreePayload({ worktreePath: "/entered/worktree" }),
      fallbackDirectory: "/process/cwd",
    });
    expect(directory).toBe("/entered/worktree");
  });

  test("prefers the EnterWorktree path over a stale cwd", () => {
    const directory = sessionDirectoryFrom({
      payload: enterWorktreePayload({
        worktreePath: "/entered/worktree",
        cwd: "/stale/previous/directory",
      }),
      fallbackDirectory: "/process/cwd",
    });
    expect(directory).toBe("/entered/worktree");
  });

  test("falls back to the process directory when payload omits cwd", () => {
    const directory = sessionDirectoryFrom({
      payload: sessionStartPayload(),
      fallbackDirectory: "/process/cwd",
    });
    expect(directory).toBe("/process/cwd");
  });

  test("falls back to the process directory when payload is not JSON", () => {
    const directory = sessionDirectoryFrom({
      payload: "not-json",
      fallbackDirectory: "/process/cwd",
    });
    expect(directory).toBe("/process/cwd");
  });
});

describe("isWorktreeRoot", () => {
  test("is true when .git is a file (linked worktree)", () => {
    const worktree = makeWorktree({ prefix: "worktree-root-file-" });
    expect(isWorktreeRoot({ directory: worktree })).toBe(true);
  });

  test("is false when .git is a directory (primary checkout)", () => {
    const checkout = tempDir({ prefix: "worktree-root-dir-" });
    mkdirSync(join(checkout, ".git"));
    expect(isWorktreeRoot({ directory: checkout })).toBe(false);
  });

  test("is false when .git is absent", () => {
    const plain = tempDir({ prefix: "worktree-root-absent-" });
    expect(isWorktreeRoot({ directory: plain })).toBe(false);
  });
});

describe("needsProvisioning", () => {
  test("is true when node_modules is absent", () => {
    const worktree = makeWorktree({ prefix: "needs-empty-" });
    expect(needsProvisioning({ sessionDirectory: worktree })).toBe(true);
  });

  test("is true when node_modules exists but the sqlite binding is missing", () => {
    const worktree = makeWorktree({ prefix: "needs-no-binding-" });
    mkdirSync(join(worktree, "node_modules"));
    expect(needsProvisioning({ sessionDirectory: worktree })).toBe(true);
  });

  test("is false when node_modules and the sqlite binding are both present", () => {
    const worktree = makeWorktree({ prefix: "needs-complete-" });
    writeSqliteBinding({ worktree });
    expect(needsProvisioning({ sessionDirectory: worktree })).toBe(false);
  });
});

describe("compileRuntimeGraph", () => {
  const writeRuntimeTool = ({
    worktree,
    exitCode = 0,
  }: {
    readonly worktree: string;
    readonly exitCode?: number;
  }) => {
    const toolsDir = join(worktree, ".claude", "tools");
    mkdirSync(toolsDir, { recursive: true });
    writeFileSync(
      join(toolsDir, "aidlc-runtime.ts"),
      `process.exit(${exitCode});\n`,
    );
  };

  const writeActiveIntentCursor = ({
    worktree,
  }: {
    readonly worktree: string;
  }) => {
    const intentsDir = join(worktree, "aidlc", "spaces", "default", "intents");
    mkdirSync(intentsDir, { recursive: true });
    writeFileSync(join(intentsDir, "active-intent"), "260725-some-intent\n");
  };

  test("reports absent when the aidlc runtime tool is not installed", () => {
    const worktree = makeWorktree({ prefix: "graph-no-tool-" });
    writeActiveIntentCursor({ worktree });
    expect(compileRuntimeGraph({ sessionDirectory: worktree })).toEqual({
      runtimeGraph: "absent",
    });
  });

  test("declines to compile rather than guessing an intent when no active-intent cursor resolves", () => {
    const worktree = makeWorktree({ prefix: "graph-no-cursor-" });
    writeRuntimeTool({ worktree });
    expect(compileRuntimeGraph({ sessionDirectory: worktree })).toEqual({
      runtimeGraph: "no-active-intent",
    });
  });

  test("compiles when the tool is installed and a cursor resolves", () => {
    const worktree = makeWorktree({ prefix: "graph-compile-ok-" });
    writeRuntimeTool({ worktree });
    writeActiveIntentCursor({ worktree });
    expect(compileRuntimeGraph({ sessionDirectory: worktree })).toEqual({
      runtimeGraph: "ok",
    });
  });

  test("reports skipped rather than throwing when the compile fails, so provisioning is never blocked", () => {
    const worktree = makeWorktree({ prefix: "graph-compile-fails-" });
    writeRuntimeTool({ worktree, exitCode: 1 });
    writeActiveIntentCursor({ worktree });
    expect(compileRuntimeGraph({ sessionDirectory: worktree })).toEqual({
      runtimeGraph: "skipped",
    });
  });
});

describe("provision-worktree direct invocation", () => {
  test("exits 0 without acting when the payload cwd is not a worktree root", async () => {
    const cwd = tempDir({ prefix: "provision-plain-" });
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      cwd,
      stdinPayload: sessionStartPayload({ cwd }),
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe("");
  });

  test("exits 0 when the process cwd is a worktree but the payload cwd is not", async () => {
    const processWorktree = makeWorktree({ prefix: "provision-process-wt-" });
    const payloadPlain = tempDir({ prefix: "provision-payload-plain-" });
    const outcome = await runRanHookProcess({
      hookFileName: HOOK,
      runtime: RUNTIME,
      cwd: processWorktree,
      stdinPayload: sessionStartPayload({ cwd: payloadPlain }),
    });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stderr).toBe("");
  });
});
