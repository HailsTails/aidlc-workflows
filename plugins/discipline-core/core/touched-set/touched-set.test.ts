import { describe, expect, it, vi } from "vitest";
import type { GitFailure, GitPort } from "../platform-ports/git-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import { computeTouchedSet, type TouchedSet } from "./touched-set.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const A = repoPathSchema.parse("a.ts");
const B = repoPathSchema.parse("src/b.md");

const FAILURE: GitFailure = {
  kind: "git-failed",
  command: "git diff --name-only -z HEAD",
  detail: "fatal: bad revision",
};

const okPaths = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "ok",
  value: [A, B, A],
});

const failed = (): Result<readonly (typeof A)[], GitFailure> => ({
  outcome: "failed",
  error: FAILURE,
});

const fakeGit = (changedSince: GitPort["changedSince"]): GitPort => ({
  trackedPaths: () => ({ outcome: "ok", value: [] }),
  changedSince,
});

const measuredMemberKeysArePaths: Equal<
  keyof Extract<TouchedSet, { readonly measured: "yes" }>,
  "measured" | "paths"
> = true;

describe("computeTouchedSet", () => {
  it("names the measured member's field paths", () => {
    expect(measuredMemberKeysArePaths).toBe(true);
  });

  it("measures the de-duplicated changed paths when a base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(okPaths),
    });

    expect(touched).toEqual({ measured: "yes", paths: new Set([A, B]) });
  });

  it("asks git for the changes since the given base under the given root", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(changedSince),
    });

    expect(changedSince).toHaveBeenCalledWith({
      repoRoot: "/repo",
      baseRevision: "abc123",
    });
  });

  it("is unmeasured with no-base-revision when no base revision is given", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(okPaths),
    });

    expect(touched).toMatchObject({
      measured: "no",
      reason: "no-base-revision",
    });
  });

  it("does not run git when no base revision is given", () => {
    const changedSince = vi.fn<GitPort["changedSince"]>().mockReturnValue(okPaths());

    computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: undefined,
      git: fakeGit(changedSince),
    });

    expect(changedSince).not.toHaveBeenCalled();
  });

  it("is unmeasured with git-failed carrying the git detail when git fails", () => {
    const touched = computeTouchedSet({
      repoRoot: REPO_ROOT,
      baseRevision: "abc123",
      git: fakeGit(failed),
    });

    expect(touched).toMatchObject({
      measured: "no",
      reason: "git-failed",
      detail: expect.stringContaining("fatal: bad revision"),
    });
  });
});
