import { spawnSync } from "node:child_process";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export type GitFailure = {
  readonly kind: "git-failed";
  readonly command: string;
  readonly detail: string;
};

export type GitPort = {
  readonly trackedPaths: (request: {
    readonly repoRoot: AbsolutePath;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: (request: {
    readonly repoRoot: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<readonly RepoPath[], GitFailure>;
};

const REPOSITORY_LOCATION_VARIABLES: readonly string[] = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_SHALLOW_FILE",
  "GIT_GRAFT_FILE",
];

const LARGEST_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

const environmentWithoutRepositoryLocation = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !REPOSITORY_LOCATION_VARIABLES.includes(name),
    ),
  );

const gitPaths = (request: {
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<readonly RepoPath[], GitFailure> => {
  const fullArguments = ["-C", request.repoRoot, ...request.gitArguments];
  const command = `git ${fullArguments.join(" ")}`;
  const run = spawnSync("git", fullArguments, {
    encoding: "utf8",
    maxBuffer: LARGEST_GIT_OUTPUT_BYTES,
    env: environmentWithoutRepositoryLocation(),
  });
  if (run.error !== undefined) {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.error.message },
    };
  }
  if (run.status !== 0) {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.stderr },
    };
  }
  const listed = run.stdout.split("\0").filter((text) => text.length > 0);
  const parsedPaths = listed.reduce<Result<readonly RepoPath[], string>>(
    (parsedSoFar, text) => {
      if (parsedSoFar.outcome === "failed") {
        return parsedSoFar;
      }
      const parsed = repoPathSchema.safeParse(text);
      return parsed.success
        ? { outcome: "ok", value: [...parsedSoFar.value, parsed.data] }
        : { outcome: "failed", error: text };
    },
    { outcome: "ok", value: [] },
  );
  if (parsedPaths.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command,
        detail: `git listed a path that is not a repo path: ${parsedPaths.error}`,
      },
    };
  }
  return parsedPaths;
};

export const createGitPort = (_options: Record<string, never>): GitPort => ({
  trackedPaths: (request) =>
    gitPaths({ repoRoot: request.repoRoot, gitArguments: ["ls-files", "-z"] }),
  changedSince: (request) => {
    const committed = gitPaths({
      repoRoot: request.repoRoot,
      gitArguments: [
        "diff",
        "--name-only",
        "-z",
        "--end-of-options",
        `${request.baseRevision}...HEAD`,
      ],
    });
    if (committed.outcome === "failed") {
      return committed;
    }
    const uncommitted = gitPaths({
      repoRoot: request.repoRoot,
      gitArguments: ["diff", "--name-only", "-z", "HEAD"],
    });
    if (uncommitted.outcome === "failed") {
      return uncommitted;
    }
    return {
      outcome: "ok",
      value: [...new Set([...committed.value, ...uncommitted.value])],
    };
  },
});
