import { describe, expect, test } from "vitest";

import type {
  PullRequestHead,
  ReviewWorktreePorts,
} from "./rin-gates-review-worktree";
import {
  describeFailure,
  prepareReviewWorktree,
  removeReviewWorktree,
  renderPrepared,
  runReviewWorktree,
  worktreePathFor,
} from "./rin-gates-review-worktree";

const HEAD_SHA = "1dc873d6aa11bb22cc33dd44ee55ff6677889900";
const OTHER_SHA = "84153766ffeeddccbbaa99887766554433221100";

const aHead = (overrides: Partial<PullRequestHead> = {}): PullRequestHead => ({
  headSha: HEAD_SHA,
  baseRef: "main",
  changedFiles: ["src/gateway.ts", "src/gateway.test.ts"],
  ...overrides,
});

const fakePorts = (
  overrides: Partial<ReviewWorktreePorts> = {},
): ReviewWorktreePorts => ({
  readPullRequestHead: () => ({ outcome: "ok", value: aHead() }),
  fetchHead: () => ({ outcome: "ok", value: undefined }),
  worktreeExists: () => false,
  addWorktree: () => ({ outcome: "ok", value: undefined }),
  removeWorktree: () => ({ outcome: "ok", value: undefined }),
  resolveHeadAt: () => ({ outcome: "ok", value: HEAD_SHA }),
  ...overrides,
});

describe("worktreePathFor", () => {
  test("names the worktree by pull request number under the checkout's worktree root", () => {
    expect(
      worktreePathFor({ workspaceRoot: "/repo", pullRequestNumber: 418 }),
    ).toContain("review-pr-418");
  });
});

describe("prepareReviewWorktree", () => {
  test("returns the PR head sha so a verdict can be bound to the reviewed tree", () => {
    const prepared = prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/.claude/worktrees/review-pr-418",
      ports: fakePorts(),
    });

    expect(prepared).toStrictEqual({
      outcome: "ok",
      value: {
        pullRequestNumber: 418,
        worktreePath: "/repo/.claude/worktrees/review-pr-418",
        headSha: HEAD_SHA,
        baseRef: "main",
        changedFiles: ["src/gateway.ts", "src/gateway.test.ts"],
      },
    });
  });

  test("checks out the pull request head rather than any local branch", () => {
    const requested: string[] = [];
    prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        addWorktree: ({ headSha }) => {
          requested.push(headSha);
          return { outcome: "ok", value: undefined };
        },
      }),
    });

    expect(requested).toStrictEqual([HEAD_SHA]);
  });

  test("replaces a stale worktree left from an earlier head", () => {
    const removed: string[] = [];
    prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        worktreeExists: () => true,
        removeWorktree: (worktreePath) => {
          removed.push(worktreePath);
          return { outcome: "ok", value: undefined };
        },
      }),
    });

    expect(removed).toStrictEqual(["/repo/wt"]);
  });

  test("fails when the prepared tree does not resolve to the PR head", () => {
    const prepared = prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        resolveHeadAt: () => ({ outcome: "ok", value: OTHER_SHA }),
      }),
    });

    expect(prepared).toStrictEqual({
      outcome: "failed",
      error: {
        kind: "head-mismatch",
        expected: HEAD_SHA,
        observed: OTHER_SHA,
      },
    });
  });

  test("fails when the pull request cannot be read", () => {
    const prepared = prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        readPullRequestHead: () => ({ outcome: "failed", error: "no such PR" }),
      }),
    });

    expect(prepared).toStrictEqual({
      outcome: "failed",
      error: {
        kind: "pull-request-unreadable",
        pullRequestNumber: 418,
        detail: "no such PR",
      },
    });
  });

  test("fails when the PR head cannot be fetched", () => {
    const prepared = prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        fetchHead: () => ({ outcome: "failed", error: "network down" }),
      }),
    });

    expect(prepared).toStrictEqual({
      outcome: "failed",
      error: {
        kind: "fetch-failed",
        pullRequestNumber: 418,
        detail: "network down",
      },
    });
  });

  test("fails when the worktree cannot be created", () => {
    const prepared = prepareReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({
        addWorktree: () => ({ outcome: "failed", error: "path in use" }),
      }),
    });

    expect(prepared).toStrictEqual({
      outcome: "failed",
      error: {
        kind: "worktree-add-failed",
        worktreePath: "/repo/wt",
        detail: "path in use",
      },
    });
  });
});

describe("removeReviewWorktree", () => {
  test("reports absent when no review worktree exists for the pull request", () => {
    const removed = removeReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({ worktreeExists: () => false }),
    });

    expect(removed).toStrictEqual({
      outcome: "ok",
      value: { kind: "absent", pullRequestNumber: 418 },
    });
  });

  test("reports the removed worktree when one was present", () => {
    const removed = removeReviewWorktree({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      ports: fakePorts({ worktreeExists: () => true }),
    });

    expect(removed).toStrictEqual({
      outcome: "ok",
      value: {
        kind: "removed",
        review: { pullRequestNumber: 418, worktreePath: "/repo/wt" },
      },
    });
  });
});

describe("runReviewWorktree", () => {
  test("prepares by default", () => {
    const result = runReviewWorktree({
      pullRequestNumber: 418,
      removing: false,
      workspaceRoot: "/repo",
      ports: fakePorts(),
    });

    expect(result.outcome === "ok" && result.value.kind).toBe("prepared");
  });

  test("removes when asked to tear down", () => {
    const result = runReviewWorktree({
      pullRequestNumber: 418,
      removing: true,
      workspaceRoot: "/repo",
      ports: fakePorts({ worktreeExists: () => true }),
    });

    expect(result.outcome === "ok" && result.value.kind).toBe("removed");
  });
});

describe("renderPrepared", () => {
  test("prints the head sha so the lead can bind each lens verdict to it", () => {
    const rendered = renderPrepared({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      headSha: HEAD_SHA,
      baseRef: "main",
      changedFiles: ["src/gateway.ts"],
    });

    expect(rendered).toContain(HEAD_SHA);
  });

  test("lists every changed file the lenses must cover", () => {
    const rendered = renderPrepared({
      pullRequestNumber: 418,
      worktreePath: "/repo/wt",
      headSha: HEAD_SHA,
      baseRef: "main",
      changedFiles: ["src/gateway.ts", "docs/readme.md"],
    });

    expect(rendered).toContain("docs/readme.md");
  });
});

describe("describeFailure", () => {
  test("names the expected and observed sha on a head mismatch", () => {
    expect(
      describeFailure({
        kind: "head-mismatch",
        expected: HEAD_SHA,
        observed: OTHER_SHA,
      }),
    ).toBe(
      `Prepared worktree resolves to ${OTHER_SHA}, expected PR head ${HEAD_SHA}`,
    );
  });

  test("names the missing flag", () => {
    expect(describeFailure({ kind: "missing-argument", flag: "--pr" })).toBe(
      "Missing required argument: --pr",
    );
  });

  test("names the malformed pull request argument", () => {
    expect(describeFailure({ kind: "malformed-pr", supplied: "abc" })).toBe(
      "--pr expects a positive integer, received: abc",
    );
  });
});
