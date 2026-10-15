import { type SpawnSyncReturns, spawnSync } from "node:child_process";
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

export type GitEnvironment = Readonly<Record<string, string | undefined>>;

export type GitRun =
  | {
      readonly outcome: "exited";
      readonly status: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly outcome: "errored"; readonly detail: string };

export type GitSpawnRequest = {
  readonly file: string;
  readonly arguments: readonly string[];
  readonly maxBuffer: number;
  readonly environment: GitEnvironment;
};

export type GitSpawn = (request: GitSpawnRequest) => GitRun;

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

const SUCCESSFUL_EXIT_STATUS = 0;

const environmentWithoutRepositoryLocation = (request: {
  readonly ambientEnvironment: GitEnvironment;
}): GitEnvironment =>
  Object.fromEntries(
    Object.entries(request.ambientEnvironment).filter(
      ([name]) => !REPOSITORY_LOCATION_VARIABLES.includes(name),
    ),
  );

const parsedRepoPaths = (request: {
  readonly listed: readonly string[];
}): Result<readonly RepoPath[], string> =>
  request.listed.reduce<Result<readonly RepoPath[], string>>(
    (parsedSoFar, text) => {
      if (parsedSoFar.outcome === "failed") {
        return parsedSoFar;
      }
      const parsed = repoPathSchema.safeParse(text);
      if (!parsed.success) {
        return { outcome: "failed", error: text };
      }
      return { outcome: "ok", value: [...parsedSoFar.value, parsed.data] };
    },
    { outcome: "ok", value: [] },
  );

const gitPaths = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<readonly RepoPath[], GitFailure> => {
  const fullArguments = ["-C", request.repoRoot, ...request.gitArguments];
  const command = `git ${fullArguments.join(" ")}`;
  const run = request.spawn({
    file: "git",
    arguments: fullArguments,
    maxBuffer: LARGEST_GIT_OUTPUT_BYTES,
    environment: request.environment,
  });
  if (run.outcome === "errored") {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.detail },
    };
  }
  if (run.status !== SUCCESSFUL_EXIT_STATUS) {
    return {
      outcome: "failed",
      error: { kind: "git-failed", command, detail: run.stderr },
    };
  }
  const parsedPaths = parsedRepoPaths({
    listed: run.stdout.split("\0").filter((text) => text.length > 0),
  });
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

type GitContext = {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
};

const changedPaths = (
  request: GitContext & { readonly baseRevision: string },
): Result<readonly RepoPath[], GitFailure> => {
  const committed = gitPaths({
    ...request,
    gitArguments: ["diff", "--name-only", "-z", "--end-of-options", `${request.baseRevision}...HEAD`],
  });
  if (committed.outcome === "failed") {
    return committed;
  }
  const uncommitted = gitPaths({ ...request, gitArguments: ["diff", "--name-only", "-z", "HEAD"] });
  if (uncommitted.outcome === "failed") {
    return uncommitted;
  }
  return { outcome: "ok", value: [...new Set([...committed.value, ...uncommitted.value])] };
};

export const createGitPort = (options: {
  readonly spawn: GitSpawn;
  readonly ambientEnvironment: GitEnvironment;
}): GitPort => {
  const environment = environmentWithoutRepositoryLocation({
    ambientEnvironment: options.ambientEnvironment,
  });
  return {
    trackedPaths: (request) =>
      gitPaths({ spawn: options.spawn, environment, repoRoot: request.repoRoot, gitArguments: ["ls-files", "-z"] }),
    changedSince: (request) =>
      changedPaths({
        spawn: options.spawn,
        environment,
        repoRoot: request.repoRoot,
        baseRevision: request.baseRevision,
      }),
  };
};

const spawnedRun = (request: GitSpawnRequest): GitRun => {
  try {
    return exitedRun({
      run: spawnSync(request.file, request.arguments, {
        encoding: "utf8",
        maxBuffer: request.maxBuffer,
        env: request.environment,
      }),
    });
  } catch (thrown) {
    return { outcome: "errored", detail: thrown instanceof Error ? thrown.message : String(thrown) };
  }
};

const exitedRun = (request: { readonly run: SpawnSyncReturns<string> }): GitRun => {
  const run = request.run;
  if (run.error !== undefined) {
    return { outcome: "errored", detail: run.error.message };
  }
  if (run.status === null) {
    return { outcome: "errored", detail: `git was ended by signal ${run.signal}` };
  }
  return { outcome: "exited", status: run.status, stdout: run.stdout, stderr: run.stderr };
};

export const defaultGitSpawn: GitSpawn = spawnedRun;

export const createDefaultGitPort = (_options: Record<string, never>): GitPort =>
  createGitPort({ spawn: defaultGitSpawn, ambientEnvironment: process.env });
