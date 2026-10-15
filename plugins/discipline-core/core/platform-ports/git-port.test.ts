import { describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { createGitPort, type GitRun, type GitSpawn } from "./git-port.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const AMBIENT_ENVIRONMENT = {
  GIT_DIR: "/elsewhere/.git",
  GIT_WORK_TREE: "/elsewhere",
  GIT_INDEX_FILE: "/elsewhere/.git/index",
  PATH: "/usr/bin",
  HOME: "/home/someone",
};

const EXITED_WITH_LISTING = {
  outcome: "exited",
  status: 0,
  stdout: "c.ts\0src/a.ts\0",
  stderr: "",
} satisfies GitRun;

const EXITED_EMPTY = { outcome: "exited", status: 0, stdout: "", stderr: "" } satisfies GitRun;

const EXITED_NOT_A_REPOSITORY = {
  outcome: "exited",
  status: 128,
  stdout: "",
  stderr: "fatal: not a git repository",
} satisfies GitRun;

const ERRORED_ON_BUFFER = { outcome: "errored", detail: "spawnSync git ENOBUFS" } satisfies GitRun;

const gitOver = (spawn: GitSpawn) =>
  createGitPort({ spawn, ambientEnvironment: AMBIENT_ENVIRONMENT });

describe("createGitPort trackedPaths", () => {
  it("runs git ls-files -z under the request's root", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).trackedPaths({ repoRoot: REPO_ROOT });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ file: "git", arguments: ["-C", "/repo", "ls-files", "-z"] }),
    );
  });

  it("hands git the ambient environment without any repository location variable", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).trackedPaths({ repoRoot: REPO_ROOT });

    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({ environment: { PATH: "/usr/bin", HOME: "/home/someone" } }),
    );
  });

  it("splits NUL-separated output, with its trailing NUL, into unquoted paths", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(EXITED_WITH_LISTING),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({ outcome: "ok", value: ["c.ts", "src/a.ts"] });
  });

  it("lists no paths for empty output", () => {
    const trackedListing = gitOver(vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY)).trackedPaths({
      repoRoot: REPO_ROOT,
    });

    expect(trackedListing).toEqual({ outcome: "ok", value: [] });
  });

  it("returns git-failed carrying stderr when git exits non-zero", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(EXITED_NOT_A_REPOSITORY),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files -z",
        detail: "fatal: not a git repository",
      },
    });
  });

  it("returns git-failed carrying the error when git could not run to completion", () => {
    const trackedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValue(ERRORED_ON_BUFFER),
    ).trackedPaths({ repoRoot: REPO_ROOT });

    expect(trackedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files -z",
        detail: "spawnSync git ENOBUFS",
      },
    });
  });
});

describe("createGitPort changedSince", () => {
  it("diffs the base range with --end-of-options before it", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(spawn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        arguments: ["-C", "/repo", "diff", "--name-only", "-z", "--end-of-options", "base...HEAD"],
      }),
    );
  });

  it("diffs the worktree against HEAD second", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValue(EXITED_EMPTY);

    gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(spawn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ arguments: ["-C", "/repo", "diff", "--name-only", "-z", "HEAD"] }),
    );
  });

  it("unites the committed and uncommitted paths", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0c.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "c.ts\0b.ts\0" });

    const changedListing = gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(changedListing).toEqual({
      outcome: "ok",
      value: expect.arrayContaining(["a.ts", "c.ts", "b.ts"]),
    });
  });

  it("lists a path in both diffs once", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0c.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "c.ts\0b.ts\0" });

    const changedListing = gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(changedListing).toHaveProperty("value.length", 3);
  });

  it("returns git-failed when the committed diff fails", () => {
    const changedListing = gitOver(
      vi.fn<GitSpawn>().mockReturnValueOnce(EXITED_NOT_A_REPOSITORY).mockReturnValueOnce(EXITED_EMPTY),
    ).changedSince({ repoRoot: REPO_ROOT, baseRevision: "no-such-revision" });

    expect(changedListing).toMatchObject({
      outcome: "failed",
      error: { kind: "git-failed", detail: "fatal: not a git repository" },
    });
  });
});
