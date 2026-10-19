import { createDefaultExecutionPort, type ExecutionPolicy } from "./execution-port.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";

export type GitFailure = {
  readonly kind: "git-failed";
  readonly command: string;
  readonly detail: string;
};

export type BaseContentMembership = "present-in-base" | "absent-from-base";

export type GitContentQuery = {
  readonly repoRoot: AbsolutePath;
  readonly baseRevision: string;
  readonly file: RepoPath;
};

export type GitPort = {
  readonly trackedPaths: (request: {
    readonly repoRoot: AbsolutePath;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly changedSince: (request: {
    readonly repoRoot: AbsolutePath;
    readonly baseRevision: string;
  }) => Result<readonly RepoPath[], GitFailure>;
  readonly contentInBase: (request: GitContentQuery) => Result<BaseContentMembership, GitFailure>;
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

const GIT_EXECUTION_POLICY: ExecutionPolicy = {
  executable: "git",
  environment: ({ ambient }) => environmentWithoutRepositoryLocation({ ambientEnvironment: ambient }),
  timeoutMilliseconds: undefined,
  maximumOutputBytes: LARGEST_GIT_OUTPUT_BYTES,
};

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

const gitOutput = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<{ readonly command: string; readonly stdout: string }, GitFailure> => {
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
  return { outcome: "ok", value: { command, stdout: run.stdout } };
};

const gitPaths = (request: {
  readonly spawn: GitSpawn;
  readonly environment: GitEnvironment;
  readonly repoRoot: AbsolutePath;
  readonly gitArguments: readonly string[];
}): Result<readonly RepoPath[], GitFailure> => {
  const output = gitOutput(request);
  if (output.outcome === "failed") {
    return output;
  }
  const parsedPaths = parsedRepoPaths({
    listed: output.value.stdout.split("\0").filter((text) => text.length > 0),
  });
  if (parsedPaths.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: output.value.command,
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
  const untracked = gitPaths({
    ...request,
    gitArguments: ["ls-files", "--others", "--exclude-standard", "-z"],
  });
  if (untracked.outcome === "failed") {
    return untracked;
  }
  return { outcome: "ok", value: [...new Set([...committed.value, ...uncommitted.value, ...untracked.value])] };
};

const objectNameStatus = (request: { readonly text: string }): "valid" | "invalid" =>
  (request.text.length === 40 || request.text.length === 64) && !/[^0-9a-f]/.test(request.text) ? "valid" : "invalid";

const contentMembership = (
  request: GitContext & GitContentQuery,
): Result<BaseContentMembership, GitFailure> => {
  const candidate = gitOutput({
    ...request,
    gitArguments: ["hash-object", "--", request.file],
  });
  if (candidate.outcome === "failed") {
    return candidate;
  }
  const candidateHash = candidate.value.stdout.replace(/\r?\n$/, "");
  if (objectNameStatus({ text: candidateHash }) === "invalid") {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: candidate.value.command,
        detail: "git hash-object did not return one complete lowercase object name",
      },
    };
  }
  const tree = gitOutput({
    ...request,
    gitArguments: ["ls-tree", "-r", "-z", "--format=%(objectname)", "--end-of-options", request.baseRevision],
  });
  if (tree.outcome === "failed") {
    return tree;
  }
  const treeHashes = tree.value.stdout === "" ? [] : tree.value.stdout.split("\0").slice(0, -1);
  if (
    (tree.value.stdout !== "" && !tree.value.stdout.endsWith("\0")) ||
    treeHashes.some((text) => objectNameStatus({ text }) === "invalid")
  ) {
    return {
      outcome: "failed",
      error: {
        kind: "git-failed",
        command: tree.value.command,
        detail: "git ls-tree did not return a complete NUL-separated object-name listing",
      },
    };
  }
  return { outcome: "ok", value: treeHashes.includes(candidateHash) ? "present-in-base" : "absent-from-base" };
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
    contentInBase: (request) => contentMembership({ ...request, spawn: options.spawn, environment }),
  };
};

export const createDefaultGitPort = (_options: Record<string, never>): GitPort => {
  const execution = createDefaultExecutionPort({ policy: GIT_EXECUTION_POLICY });
  return createGitPort({
    spawn: (request) => {
      const executed = execution.run({ arguments: request.arguments });
      if (executed.outcome === "failed") {
        return {
          outcome: "errored",
          detail: executed.error.kind === "terminated"
            ? `git was ended by signal ${executed.error.signal}`
            : executed.error.detail,
        };
      }
      return { outcome: "exited", ...executed.value };
    },
    ambientEnvironment: {},
  });
};
