import { describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
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

  it("unites committed, uncommitted and untracked paths in first-encounter order", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "z.ts\0shared.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "shared.ts\0a.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0z.ts\0untracked.ts\0" });

    const changedListing = gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(changedListing).toEqual({
      outcome: "ok",
      value: ["z.ts", "shared.ts", "a.ts", "untracked.ts"],
    });
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(spawn).toHaveBeenNthCalledWith(3, {
      file: "git",
      arguments: ["-C", "/repo", "ls-files", "--others", "--exclude-standard", "-z"],
      maxBuffer: 268435456,
      environment: { PATH: "/usr/bin", HOME: "/home/someone" },
    });
  });

  it("lists a path in both diffs once", () => {
    const spawn = vi
      .fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "a.ts\0c.ts\0" })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "c.ts\0b.ts\0" })
      .mockReturnValueOnce(EXITED_EMPTY);

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

  it("fails without returning a successful prefix when the untracked operation cannot complete", () => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce(EXITED_WITH_LISTING)
      .mockReturnValueOnce(EXITED_EMPTY)
      .mockReturnValueOnce(ERRORED_ON_BUFFER);

    const changedListing = gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(changedListing).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git -C /repo ls-files --others --exclude-standard -z", detail: "spawnSync git ENOBUFS" },
    });
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it("refuses an invalid later untracked path without publishing any successful prefix", () => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce(EXITED_WITH_LISTING)
      .mockReturnValueOnce(EXITED_EMPTY)
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: "new.ts\0../outside.ts\0" });

    const changedListing = gitOver(spawn).changedSince({ repoRoot: REPO_ROOT, baseRevision: "base" });

    expect(changedListing).toEqual({
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: "git -C /repo ls-files --others --exclude-standard -z",
        detail: "git listed a path that is not a repo path: ../outside.ts",
      },
    });
  });
});

const CANDIDATE_HASH = "0123456789abcdef0123456789abcdef01234567";
const OTHER_HASH = "abcdef0123456789abcdef0123456789abcdef01";
const SHA256_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const OTHER_SHA256_HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const CONTENT_FILE = repoPathSchema.parse("src/example.ts");

describe("createGitPort contentInBase", () => {
  it("finds exact candidate content in the selected tree using option-safe arguments and Git policy", () => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\r\n` })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${OTHER_HASH}\0${CANDIDATE_HASH}\0` });

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "-selected-base", file: repoPathSchema.parse("-candidate.ts") });

    expect(membership).toEqual({ outcome: "ok", value: "present-in-base" });
    expect(spawn.mock.calls).toEqual([
      [{ file: "git", arguments: ["-C", "/repo", "hash-object", "--", "-candidate.ts"], maxBuffer: 268435456, environment: { PATH: "/usr/bin", HOME: "/home/someone" } }],
      [{ file: "git", arguments: ["-C", "/repo", "ls-tree", "-r", "-z", "--format=%(objectname)", "--end-of-options", "-selected-base"], maxBuffer: 268435456, environment: { PATH: "/usr/bin", HOME: "/home/someone" } }],
    ]);
  });

  it.each([
    { name: "unmatched content despite other tree objects", hashOutput: `${SHA256_HASH}\n`, treeOutput: `${OTHER_SHA256_HASH}\0` },
    { name: "a successfully read empty base tree", hashOutput: CANDIDATE_HASH, treeOutput: "" },
  ])("returns absent for $name", ({ hashOutput, treeOutput }) => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: hashOutput })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: treeOutput });

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "base", file: CONTENT_FILE });

    expect(membership).toEqual({ outcome: "ok", value: "absent-from-base" });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn).toHaveBeenNthCalledWith(2, expect.objectContaining({
      arguments: ["-C", "/repo", "ls-tree", "-r", "-z", "--format=%(objectname)", "--end-of-options", "base"],
    }));
  });

  it.each([
    { name: "empty", stdout: "" },
    { name: "malformed", stdout: "not-an-object\n" },
    { name: "multiple", stdout: `${CANDIDATE_HASH}\n${CANDIDATE_HASH}\n` },
  ])("refuses $name candidate hash output before querying the tree", ({ stdout }) => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce({ ...EXITED_EMPTY, stdout });

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "base", file: CONTENT_FILE });

    expect(membership).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git -C /repo hash-object -- src/example.ts", detail: expect.stringMatching(/\S/) },
    });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: "malformed later entry despite a matching prefix", stdout: `${CANDIDATE_HASH}\0not-an-object\0` },
    { name: "unterminated tree entry", stdout: CANDIDATE_HASH },
  ])("refuses $name rather than returning content membership", ({ stdout }) => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\n` })
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout });

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "base", file: CONTENT_FILE });

    expect(membership).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git -C /repo ls-tree -r -z --format=%(objectname) --end-of-options base", detail: expect.stringMatching(/\S/) },
    });
  });

  it("preserves candidate process failure without attempting a selected-tree query", () => {
    const spawn = vi.fn<GitSpawn>().mockReturnValueOnce(ERRORED_ON_BUFFER);

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "base", file: CONTENT_FILE });

    expect(membership).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git -C /repo hash-object -- src/example.ts", detail: "spawnSync git ENOBUFS" },
    });
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("preserves an invalid selected base as GitFailure rather than absent membership", () => {
    const spawn = vi.fn<GitSpawn>()
      .mockReturnValueOnce({ ...EXITED_EMPTY, stdout: `${CANDIDATE_HASH}\n` })
      .mockReturnValueOnce({ ...EXITED_NOT_A_REPOSITORY, stderr: "fatal: not a valid object name missing-base" });

    const membership = gitOver(spawn).contentInBase({ repoRoot: REPO_ROOT, baseRevision: "missing-base", file: CONTENT_FILE });

    expect(membership).toEqual({
      outcome: "failed",
      error: { kind: "git-failed", command: "git -C /repo ls-tree -r -z --format=%(objectname) --end-of-options missing-base", detail: "fatal: not a valid object name missing-base" },
    });
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});
