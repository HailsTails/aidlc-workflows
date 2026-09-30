// rin-gates review worktree preparer — puts a review lens ON the PR head.
//
// The rin-pr-* review lenses are granted `Read, Grep, Glob`: no Bash, no gh.
// They cannot fetch or check out anything. The Gate-5 sweep session, meanwhile,
// is required by the rails to `git merge --ff-only origin/main`, so ITS worktree
// is main — never a PR head. A lens dispatched without a pinned cwd inherits
// that tree and reads already-merged code as though it were the diff. Observed
// twice (2026-08-02, 2026-08-03): confident, precise, factually inverted
// findings indistinguishable from sound ones, and a five-way READY from agents
// that never saw a diff.
//
// Prose telling the lead to pre-fetch does not remove that failure; it only asks
// the lead to remember. This tool removes it structurally — it prepares a
// worktree already checked out at the PR's current head and prints the path, the
// head sha, and the changed-file list. Dispatch each lens with its cwd pinned to
// that path and reading the tree IS reading the PR.
//
// The head sha is the binding token: pass it into each lens prompt and require it
// back in the verdict, so a verdict that reviewed some other tree is detectable
// rather than merely unlikely.
//
// Usage:
//   bun .claude/tools/rin-gates/rin-gates-review-worktree.ts --pr <N> [--json]
//                                                            [--remove]
//     --pr      the pull request number to prepare
//     --json    machine-readable output
//     --remove  tear down this PR's review worktree instead of preparing it
//
// Env seams (selftest hermeticity): RIN_GATES_WORKSPACE_ROOT.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

const REVIEW_WORKTREE_PREFIX = "review-pr";

type PreparedReview = {
  readonly pullRequestNumber: number;
  readonly worktreePath: string;
  readonly headSha: string;
  readonly baseRef: string;
  readonly changedFiles: readonly string[];
};

type RemovedReview = {
  readonly pullRequestNumber: number;
  readonly worktreePath: string;
};

type ReviewWorktreeOutcome =
  | { readonly kind: "prepared"; readonly review: PreparedReview }
  | { readonly kind: "removed"; readonly review: RemovedReview }
  | { readonly kind: "absent"; readonly pullRequestNumber: number };

type ReviewWorktreeFailure =
  | { readonly kind: "missing-argument"; readonly flag: string }
  | { readonly kind: "malformed-pr"; readonly supplied: string }
  | {
      readonly kind: "pull-request-unreadable";
      readonly pullRequestNumber: number;
      readonly detail: string;
    }
  | {
      readonly kind: "fetch-failed";
      readonly pullRequestNumber: number;
      readonly detail: string;
    }
  | {
      readonly kind: "worktree-add-failed";
      readonly worktreePath: string;
      readonly detail: string;
    }
  | {
      readonly kind: "worktree-remove-failed";
      readonly worktreePath: string;
      readonly detail: string;
    }
  | {
      readonly kind: "head-mismatch";
      readonly expected: string;
      readonly observed: string;
    };

type PullRequestHead = {
  readonly headSha: string;
  readonly baseRef: string;
  readonly changedFiles: readonly string[];
};

type ReviewWorktreePorts = {
  readonly readPullRequestHead: (
    pullRequestNumber: number,
  ) => Result<PullRequestHead, string>;
  readonly fetchHead: (pullRequestNumber: number) => Result<void, string>;
  readonly worktreeExists: (worktreePath: string) => boolean;
  readonly addWorktree: (args: {
    readonly worktreePath: string;
    readonly headSha: string;
  }) => Result<void, string>;
  readonly removeWorktree: (worktreePath: string) => Result<void, string>;
  readonly resolveHeadAt: (worktreePath: string) => Result<string, string>;
};

const worktreePathFor = (args: {
  readonly workspaceRoot: string;
  readonly pullRequestNumber: number;
}): string =>
  join(
    args.workspaceRoot,
    ".claude",
    "worktrees",
    `${REVIEW_WORKTREE_PREFIX}-${args.pullRequestNumber}`,
  );

const prepareReviewWorktree = (args: {
  readonly pullRequestNumber: number;
  readonly worktreePath: string;
  readonly ports: ReviewWorktreePorts;
}): Result<PreparedReview, ReviewWorktreeFailure> => {
  const head = args.ports.readPullRequestHead(args.pullRequestNumber);
  if (head.outcome === "failed") {
    return failWith({
      kind: "pull-request-unreadable",
      pullRequestNumber: args.pullRequestNumber,
      detail: head.error,
    });
  }

  const fetched = args.ports.fetchHead(args.pullRequestNumber);
  if (fetched.outcome === "failed") {
    return failWith({
      kind: "fetch-failed",
      pullRequestNumber: args.pullRequestNumber,
      detail: fetched.error,
    });
  }

  if (args.ports.worktreeExists(args.worktreePath)) {
    const removed = args.ports.removeWorktree(args.worktreePath);
    if (removed.outcome === "failed") {
      return failWith({
        kind: "worktree-remove-failed",
        worktreePath: args.worktreePath,
        detail: removed.error,
      });
    }
  }

  const added = args.ports.addWorktree({
    worktreePath: args.worktreePath,
    headSha: head.value.headSha,
  });
  if (added.outcome === "failed") {
    return failWith({
      kind: "worktree-add-failed",
      worktreePath: args.worktreePath,
      detail: added.error,
    });
  }

  const observed = args.ports.resolveHeadAt(args.worktreePath);
  if (observed.outcome === "failed") {
    return failWith({
      kind: "worktree-add-failed",
      worktreePath: args.worktreePath,
      detail: observed.error,
    });
  }
  if (observed.value !== head.value.headSha) {
    return failWith({
      kind: "head-mismatch",
      expected: head.value.headSha,
      observed: observed.value,
    });
  }

  return succeed({
    pullRequestNumber: args.pullRequestNumber,
    worktreePath: args.worktreePath,
    headSha: head.value.headSha,
    baseRef: head.value.baseRef,
    changedFiles: head.value.changedFiles,
  });
};

const removeReviewWorktree = (args: {
  readonly pullRequestNumber: number;
  readonly worktreePath: string;
  readonly ports: ReviewWorktreePorts;
}): Result<ReviewWorktreeOutcome, ReviewWorktreeFailure> => {
  if (!args.ports.worktreeExists(args.worktreePath)) {
    return succeed({
      kind: "absent",
      pullRequestNumber: args.pullRequestNumber,
    });
  }
  const removed = args.ports.removeWorktree(args.worktreePath);
  return removed.outcome === "failed"
    ? failWith({
        kind: "worktree-remove-failed",
        worktreePath: args.worktreePath,
        detail: removed.error,
      })
    : succeed({
        kind: "removed",
        review: {
          pullRequestNumber: args.pullRequestNumber,
          worktreePath: args.worktreePath,
        },
      });
};

const runReviewWorktree = (args: {
  readonly pullRequestNumber: number;
  readonly removing: boolean;
  readonly workspaceRoot: string;
  readonly ports: ReviewWorktreePorts;
}): Result<ReviewWorktreeOutcome, ReviewWorktreeFailure> => {
  const worktreePath = worktreePathFor({
    workspaceRoot: args.workspaceRoot,
    pullRequestNumber: args.pullRequestNumber,
  });

  if (args.removing) {
    return removeReviewWorktree({
      pullRequestNumber: args.pullRequestNumber,
      worktreePath,
      ports: args.ports,
    });
  }

  const prepared = prepareReviewWorktree({
    pullRequestNumber: args.pullRequestNumber,
    worktreePath,
    ports: args.ports,
  });
  return prepared.outcome === "failed"
    ? prepared
    : succeed({ kind: "prepared", review: prepared.value });
};

const describeFailure = (failure: ReviewWorktreeFailure): string => {
  switch (failure.kind) {
    case "missing-argument":
      return `Missing required argument: ${failure.flag}`;
    case "malformed-pr":
      return `--pr expects a positive integer, received: ${failure.supplied}`;
    case "pull-request-unreadable":
      return `Could not read PR #${failure.pullRequestNumber}: ${failure.detail}`;
    case "fetch-failed":
      return `Could not fetch PR #${failure.pullRequestNumber} head: ${failure.detail}`;
    case "worktree-add-failed":
      return `Could not prepare worktree at ${failure.worktreePath}: ${failure.detail}`;
    case "worktree-remove-failed":
      return `Could not remove worktree at ${failure.worktreePath}: ${failure.detail}`;
    case "head-mismatch":
      return `Prepared worktree resolves to ${failure.observed}, expected PR head ${failure.expected}`;
  }
};

const renderPrepared = (review: PreparedReview): string =>
  [
    `Review worktree ready for PR #${review.pullRequestNumber}`,
    ``,
    `  path      ${review.worktreePath}`,
    `  head sha  ${review.headSha}`,
    `  base      ${review.baseRef}`,
    `  files     ${review.changedFiles.length} changed`,
    ``,
    `Dispatch every rin-pr-* lens for this PR with its cwd pinned to that path.`,
    `Pass the head sha in each prompt and require it back in the verdict — a`,
    `verdict carrying a different sha did not review this PR.`,
    ``,
    `Changed files:`,
    ...review.changedFiles.map((file) => `  ${file}`),
  ].join("\n");

const runGitAt = (
  commandArguments: readonly string[],
  cwd: string,
): Result<string, string> => {
  const spawned = spawnSync("git", [...commandArguments], {
    encoding: "utf-8",
    cwd,
  });
  return spawned.status === 0
    ? succeed((spawned.stdout ?? "").trim())
    : failWith((spawned.stderr ?? spawned.stdout ?? "").trim());
};

const readPullRequestHeadAt = (args: {
  readonly pullRequestNumber: number;
  readonly workspaceRoot: string;
}): Result<PullRequestHead, string> => {
  const spawned = spawnSync(
    "gh",
    [
      "pr",
      "view",
      String(args.pullRequestNumber),
      "--json",
      "headRefOid,baseRefName,files",
    ],
    { encoding: "utf-8", cwd: args.workspaceRoot },
  );
  if (spawned.status !== 0) {
    return failWith((spawned.stderr ?? spawned.stdout ?? "").trim());
  }
  try {
    const parsed: unknown = JSON.parse(spawned.stdout ?? "");
    const view = parsed as {
      readonly headRefOid?: unknown;
      readonly baseRefName?: unknown;
      readonly files?: readonly { readonly path?: unknown }[];
    };
    const headSha = view.headRefOid;
    const baseRef = view.baseRefName;
    if (typeof headSha !== "string" || typeof baseRef !== "string") {
      return failWith("PR view returned no headRefOid/baseRefName");
    }
    const changedFiles = (view.files ?? [])
      .map((file) => file.path)
      .filter((path): path is string => typeof path === "string");
    return succeed({ headSha, baseRef, changedFiles });
  } catch (error) {
    return failWith(error instanceof Error ? error.message : String(error));
  }
};

const gitPorts = (workspaceRoot: string): ReviewWorktreePorts => {
  const runGit = (
    commandArguments: readonly string[],
    cwd: string,
  ): Result<string, string> => runGitAt(commandArguments, cwd);

  return {
    readPullRequestHead: (pullRequestNumber) =>
      readPullRequestHeadAt({ pullRequestNumber, workspaceRoot }),
    fetchHead: (pullRequestNumber) =>
      runGit(
        [
          "fetch",
          "origin",
          `pull/${pullRequestNumber}/head`,
          "--no-tags",
          "--force",
        ],
        workspaceRoot,
      ).outcome === "ok"
        ? succeed(undefined)
        : failWith(`git fetch of pull/${pullRequestNumber}/head failed`),
    worktreeExists: (worktreePath) => existsSync(worktreePath),
    addWorktree: ({ worktreePath, headSha }) => {
      const added = runGit(
        ["worktree", "add", "--detach", worktreePath, headSha],
        workspaceRoot,
      );
      return added.outcome === "ok"
        ? succeed(undefined)
        : failWith(added.error);
    },
    removeWorktree: (worktreePath) => {
      const removed = runGit(
        ["worktree", "remove", "--force", worktreePath],
        workspaceRoot,
      );
      return removed.outcome === "ok"
        ? succeed(undefined)
        : failWith(removed.error);
    },
    resolveHeadAt: (worktreePath) =>
      runGit(["rev-parse", "HEAD"], worktreePath),
  };
};

const checkoutRootFrom = (start: string, fallback = resolve(start)): string => {
  const dir = resolve(start);
  if (existsSync(join(dir, ".git"))) return dir;
  const parent = dirname(dir);
  return parent === dir ? fallback : checkoutRootFrom(parent, fallback);
};

const argValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  return index === -1 || index + 1 >= process.argv.length
    ? null
    : (process.argv[index + 1] ?? null);
};

const main = (): void => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot =
    process.env["RIN_GATES_WORKSPACE_ROOT"] ?? checkoutRootFrom(HERE);
  const asJson = process.argv.includes("--json");
  const removing = process.argv.includes("--remove");

  const exitReporting: (failure: ReviewWorktreeFailure) => never = (
    failure,
  ) => {
    process.stderr.write(`${describeFailure(failure)}\n`);
    process.exit(1);
  };

  const supplied = argValue("--pr");
  if (supplied === null) {
    exitReporting({ kind: "missing-argument", flag: "--pr" });
  }

  const pullRequestNumber = Number(supplied);
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    exitReporting({ kind: "malformed-pr", supplied });
  }

  const result = runReviewWorktree({
    pullRequestNumber,
    removing,
    workspaceRoot,
    ports: gitPorts(workspaceRoot),
  });

  if (result.outcome === "failed") exitReporting(result.error);

  const outcome = result.value;

  if (asJson) {
    process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    return;
  }

  switch (outcome.kind) {
    case "prepared":
      process.stdout.write(`${renderPrepared(outcome.review)}\n`);
      return;
    case "removed":
      process.stdout.write(
        `Removed review worktree for PR #${outcome.review.pullRequestNumber}\n`,
      );
      return;
    case "absent":
      process.stdout.write(
        `No review worktree present for PR #${outcome.pullRequestNumber}\n`,
      );
      return;
  }
};

if (import.meta.main) main();

export type {
  PreparedReview,
  PullRequestHead,
  ReviewWorktreeFailure,
  ReviewWorktreeOutcome,
  ReviewWorktreePorts,
};
export {
  describeFailure,
  prepareReviewWorktree,
  removeReviewWorktree,
  renderPrepared,
  runReviewWorktree,
  worktreePathFor,
};
