import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  holdsUnsalvagedWork,
  huskDirectories,
  isRemovableHusk,
  sweepHusks,
} from "./prune-worktree-husks.mjs";

const createdRoots: string[] = [];

const tempDir = ({ prefix }: { readonly prefix: string }) => {
  const root = mkdtempSync(join(tmpdir(), prefix));
  createdRoots.push(root);
  return root;
};

const makeDir = ({ at }: { readonly at: string }) => {
  mkdirSync(at, { recursive: true });
  return at;
};

const makeShellHusk = ({
  root,
  name,
}: {
  readonly root: string;
  readonly name: string;
}) => {
  const directory = join(root, name);
  makeDir({ at: join(directory, "apps") });
  makeDir({ at: join(directory, "packages") });
  makeDir({ at: join(directory, "node_modules", ".pnpm", "left-behind") });
  return directory;
};

afterEach(() => {
  createdRoots.splice(0).forEach((root) => {
    rmSync(root, { recursive: true, force: true });
  });
});

describe("holdsUnsalvagedWork", () => {
  test("is false for a directory containing only empty subdirectories", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-shell-" }),
      name: "wt",
    });
    expect(holdsUnsalvagedWork({ directory: husk })).toBe(false);
  });

  test("ignores files nested under node_modules", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-nm-" }),
      name: "wt",
    });
    writeFileSync(
      join(husk, "node_modules", ".pnpm", "left-behind", "index.js"),
      "x",
    );
    expect(holdsUnsalvagedWork({ directory: husk })).toBe(false);
  });

  test("is true when any non-node_modules file exists", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-work-" }),
      name: "wt",
    });
    writeFileSync(
      join(husk, "apps", "unsaved.ts"),
      "export const stranded = true;",
    );
    expect(holdsUnsalvagedWork({ directory: husk })).toBe(true);
  });
});

describe("isRemovableHusk", () => {
  test("refuses to remove the protected session directory", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-protected-" }),
      name: "wt",
    });
    expect(isRemovableHusk({ directory: husk, protectedDirectory: husk })).toBe(
      false,
    );
  });

  test("removes an empty shell husk", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-empty-" }),
      name: "wt",
    });
    expect(
      isRemovableHusk({ directory: husk, protectedDirectory: "/other" }),
    ).toBe(true);
  });

  test("refuses a husk that holds real work", () => {
    const husk = makeShellHusk({
      root: tempDir({ prefix: "husk-realwork-" }),
      name: "wt",
    });
    writeFileSync(join(husk, "packages", "keep.ts"), "1");
    expect(
      isRemovableHusk({ directory: husk, protectedDirectory: "/other" }),
    ).toBe(false);
  });
});

describe("huskDirectories", () => {
  test("returns on-disk directories absent from the tracked set", () => {
    const worktreesRoot = tempDir({ prefix: "husk-diff-" });
    const tracked = makeShellHusk({ root: worktreesRoot, name: "tracked" });
    const husk = makeShellHusk({ root: worktreesRoot, name: "orphan" });
    const result = huskDirectories({
      worktreesRoot,
      tracked: new Set([resolve(tracked)]),
    });
    expect(result).toEqual([resolve(husk)]);
  });

  test("returns empty when the worktrees root does not exist", () => {
    const result = huskDirectories({
      worktreesRoot: join(tempDir({ prefix: "husk-none-" }), "missing"),
      tracked: new Set(),
    });
    expect(result).toEqual([]);
  });
});

describe("sweepHusks", () => {
  test("deletes shell husks, preserves work husks, tracked, and the protected cwd", () => {
    const toplevel = tempDir({ prefix: "husk-sweep-" });
    execSync("git init --quiet", { cwd: toplevel });
    const worktreesRoot = join(toplevel, ".claude", "worktrees");
    makeDir({ at: worktreesRoot });

    const orphanShell = makeShellHusk({
      root: worktreesRoot,
      name: "orphan-shell",
    });
    const orphanWork = makeShellHusk({
      root: worktreesRoot,
      name: "orphan-work",
    });
    writeFileSync(join(orphanWork, "apps", "stranded.ts"), "keep me");
    const protectedCwd = makeShellHusk({
      root: worktreesRoot,
      name: "current-session",
    });

    const outcome = sweepHusks({
      toplevel,
      protectedDirectory: resolve(protectedCwd),
    });

    expect(existsSync(orphanShell)).toBe(false);
    expect(existsSync(orphanWork)).toBe(true);
    expect(existsSync(protectedCwd)).toBe(true);
    expect(outcome.removed).toBe(1);
  });

  test("is a no-op outside a git repository", () => {
    const notARepo = tempDir({ prefix: "husk-norepo-" });
    const outcome = sweepHusks({
      toplevel: notARepo,
      protectedDirectory: notARepo,
    });
    expect(outcome).toEqual({ removed: 0, skipped: 0 });
  });
});
