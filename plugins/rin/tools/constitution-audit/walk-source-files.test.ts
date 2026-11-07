import { join } from "node:path";
import { expect, test } from "vitest";
import {
  type DirectoryEntry,
  type DirectoryReader,
  isExcludedDirectory,
  isExcludedRootDirectory,
  walkSourceFiles,
} from "./walk-source-files.js";

const fakeReaderFrom = ({
  tree,
}: {
  readonly tree: Readonly<Record<string, readonly DirectoryEntry[]>>;
}): DirectoryReader => {
  return (directoryPath) => tree[directoryPath] ?? [];
};

const file = (name: string): DirectoryEntry => ({ name, isDirectory: false });
const dir = (name: string): DirectoryEntry => ({ name, isDirectory: true });

test("collects files under the root", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("src")],
      [join("root", "src")]: [file("entity.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "src", "entity.ts"),
  ]);
});

test("descends nested authored directories", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("src")],
      [join("root", "src")]: [dir("domain")],
      [join("root", "src", "domain")]: [file("clock.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "src", "domain", "clock.ts"),
  ]);
});

test("does not descend node_modules", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [file("index.ts"), dir("node_modules")],
      [join("root", "node_modules")]: [file("buried.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "index.ts"),
  ]);
});

test("does not descend a nested .claude worktrees tree", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [file("index.ts"), dir(".claude")],
      [join("root", ".claude")]: [dir("worktrees")],
      [join("root", ".claude", "worktrees")]: [file("buried.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "index.ts"),
  ]);
});

test("prunes generated and derived directories", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [
        file("index.ts"),
        dir(".git"),
        dir("dist"),
        dir("build"),
        dir("coverage"),
        dir("aidlc"),
        dir(".aidlc"),
      ],
      [join("root", ".git")]: [file("buried.ts")],
      [join("root", "dist")]: [file("buried.ts")],
      [join("root", "build")]: [file("buried.ts")],
      [join("root", "coverage")]: [file("buried.ts")],
      [join("root", "aidlc")]: [file("buried.ts")],
      [join("root", ".aidlc")]: [file("buried.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "index.ts"),
  ]);
});

test("never descends vendored upstream or a composed harness face", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [
        dir("vendor"),
        dir(".codex"),
        dir(".opencode"),
        dir(".agents"),
        dir("plugins"),
      ],
      [join("root", "vendor")]: [dir("aidlc-upstream")],
      [join("root", "vendor", "aidlc-upstream")]: [file("upstream.ts")],
      [join("root", ".codex")]: [file("composed.ts")],
      [join("root", ".opencode")]: [file("composed.ts")],
      [join("root", ".agents")]: [file("composed.ts")],
      [join("root", "plugins")]: [dir("rin")],
      [join("root", "plugins", "rin")]: [file("authored.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "plugins", "rin", "authored.ts"),
  ]);
});

test("prunes generated release output while retaining sibling source", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("packages")],
      [join("root", "packages")]: [dir("tool")],
      [join("root", "packages", "tool")]: [dir("src"), dir("dist-release")],
      [join("root", "packages", "tool", "src")]: [file("source.ts")],
      [join("root", "packages", "tool", "dist-release")]: [
        file("generated.ts"),
      ],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "packages", "tool", "src", "source.ts"),
  ]);
});

test("returns empty for an unreadable root", () => {
  const readDirectory = fakeReaderFrom({ tree: {} });
  expect(walkSourceFiles({ rootDir: "absent", readDirectory })).toEqual([]);
});

test("isExcludedDirectory reports membership of the excluded set", () => {
  expect(isExcludedDirectory({ name: "node_modules" })).toBe(true);
  expect(isExcludedDirectory({ name: "src" })).toBe(false);
});

test("returns a nested vendor directory below the root", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("apps")],
      [join("root", "apps")]: [dir("x")],
      [join("root", "apps", "x")]: [dir("src")],
      [join("root", "apps", "x", "src")]: [dir("vendor")],
      [join("root", "apps", "x", "src", "vendor")]: [file("a.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "apps", "x", "src", "vendor", "a.ts"),
  ]);
});

test("does not return a root-level vendor directory", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("vendor")],
      [join("root", "vendor")]: [file("a.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([]);
});

test("returns a nested codex directory below the root", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir("apps")],
      [join("root", "apps")]: [dir(".codex")],
      [join("root", "apps", ".codex")]: [file("a.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([
    join("root", "apps", ".codex", "a.ts"),
  ]);
});

test("does not return a root-level codex directory", () => {
  const readDirectory = fakeReaderFrom({
    tree: {
      root: [dir(".codex")],
      [join("root", ".codex")]: [file("a.ts")],
    },
  });
  expect(walkSourceFiles({ rootDir: "root", readDirectory })).toEqual([]);
});

test("isExcludedDirectory keeps root-only names in scope below the root", () => {
  expect(isExcludedDirectory({ name: "vendor" })).toBe(false);
  expect(isExcludedDirectory({ name: ".codex" })).toBe(false);
});

test("isExcludedRootDirectory excludes vendored upstream", () => {
  expect(isExcludedRootDirectory({ name: "vendor" })).toBe(true);
});

test("isExcludedRootDirectory excludes the composed codex face", () => {
  expect(isExcludedRootDirectory({ name: ".codex" })).toBe(true);
});

test("isExcludedRootDirectory excludes the installed opencode face", () => {
  expect(isExcludedRootDirectory({ name: ".opencode" })).toBe(true);
});

test("isExcludedRootDirectory excludes the composed agents skill face", () => {
  expect(isExcludedRootDirectory({ name: ".agents" })).toBe(true);
});

test("isExcludedRootDirectory still excludes the any-depth names", () => {
  expect(isExcludedRootDirectory({ name: "node_modules" })).toBe(true);
});

test("isExcludedRootDirectory keeps the authored plugin source in scope", () => {
  expect(isExcludedRootDirectory({ name: "plugins" })).toBe(false);
  expect(isExcludedDirectory({ name: "rin" })).toBe(false);
});
