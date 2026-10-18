import { createDefaultExecutionPort, defaultExecutionEnvironmentSnapshot, type ExecutionEnvironment, type ExecutionExit, type ExecutionFailure, type ExecutionPolicy, type ExecutionPort } from "../../core/platform-ports/execution-port.ts";
import { createDefaultFileTextPort, createDefaultTemporaryDirectoryPort, type FileTextPort, type TemporaryDirectoryFailure, type TemporaryDirectoryPort } from "../../core/platform-ports/file-system-port.ts";
import { createDefaultPathPort, type PathPort } from "../../core/platform-ports/path-port.ts";
import type { AbsolutePath } from "../../core/values/absolute-path.ts";
import type { Result } from "../../core/values/result.ts";
import { type HermeticGitEnvironment, hermeticGitEnvironment } from "./hermetic-git-environment.ts";

export type HermeticGitCommandFailure =
  | {
      readonly kind: "execution-failed";
      readonly arguments: readonly string[];
      readonly failure: ExecutionFailure;
    }
  | {
      readonly kind: "git-exited";
      readonly arguments: readonly string[];
      readonly exit: ExecutionExit;
    };

export type HermeticGitOperationFailure =
  | TemporaryDirectoryFailure
  | HermeticGitCommandFailure
  | { readonly kind: "arguments-invalid"; readonly detail: string }
  | { readonly kind: "file-unwritable"; readonly path: string; readonly detail: string }
  | { readonly kind: "environment-unavailable"; readonly failure: ExecutionFailure };

export type HermeticGitCreationFailure = {
  readonly kind: "repository-creation-failed";
  readonly failure: HermeticGitOperationFailure;
  readonly enclosure: AbsolutePath | undefined;
};

export type HermeticGitRepository = {
  readonly path: AbsolutePath;
  readonly environment: HermeticGitEnvironment;
  readonly run: (request: { readonly arguments: readonly string[] }) => Result<string, HermeticGitCommandFailure>;
  readonly writeFile: (request: { readonly relativePath: string; readonly body: string }) => Result<void, HermeticGitOperationFailure>;
  readonly commitAll: (request: { readonly message: string }) => Result<void, HermeticGitCommandFailure>;
  readonly dispose: () => Result<void, TemporaryDirectoryFailure>;
};

const creationFailed = (request: {
  readonly failure: HermeticGitOperationFailure;
  readonly enclosure: AbsolutePath | undefined;
}): { readonly outcome: "failed"; readonly error: HermeticGitCreationFailure } => ({
  outcome: "failed",
  error: { kind: "repository-creation-failed", ...request },
});

const runGit = (request: {
  readonly execution: ExecutionPort;
  readonly cwd: AbsolutePath;
  readonly arguments: readonly string[];
}): Result<string, HermeticGitCommandFailure> => {
  const executed = request.execution.run({ arguments: request.arguments, cwd: request.cwd });
  if (executed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "execution-failed", arguments: request.arguments, failure: executed.error } };
  }
  if (executed.value.status !== 0) {
    return { outcome: "failed", error: { kind: "git-exited", arguments: request.arguments, exit: executed.value } };
  }
  return { outcome: "ok", value: executed.value.stdout };
};

export const createHermeticGitRepository = (request: {
  readonly namePrefix?: string;
} = {}): Result<HermeticGitRepository, HermeticGitCreationFailure> => {
  const ambient = defaultExecutionEnvironmentSnapshot({});
  if (ambient.outcome === "failed") {
    return creationFailed({ failure: { kind: "environment-unavailable", failure: ambient.error }, enclosure: undefined });
  }
  return createHermeticGitRepositoryWithPorts({
    ...request,
    ambient: ambient.value,
    temporaryDirectories: createDefaultTemporaryDirectoryPort({}),
    fileText: createDefaultFileTextPort({}),
    path: createDefaultPathPort({}),
    execution: createDefaultExecutionPort,
  });
};

export const createHermeticGitRepositoryWithPorts = (options: {
  readonly namePrefix?: string;
  readonly ambient: ExecutionEnvironment;
  readonly temporaryDirectories: TemporaryDirectoryPort;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly execution: (request: {
    readonly policy: ExecutionPolicy;
    readonly ambientEnvironment: ExecutionEnvironment;
  }) => ExecutionPort;
}): Result<HermeticGitRepository, HermeticGitCreationFailure> => {
  const allocated = options.temporaryDirectories.create({ namePrefix: options.namePrefix ?? "rin-hermetic-" });
  if (allocated.outcome === "failed") return creationFailed({ failure: allocated.error, enclosure: undefined });
  const enclosure = allocated.value.path;
  const repository = options.path.resolve({ path: options.path.join({ segments: [enclosure, "repository"] }) });
  if (repository.outcome === "failed") {
    return creationFailed({ failure: { kind: "arguments-invalid", detail: `cannot resolve ${repository.error.path}` }, enclosure });
  }
  const home = options.path.resolve({ path: options.path.join({ segments: [enclosure, "home"] }) });
  if (home.outcome === "failed") {
    return creationFailed({ failure: { kind: "arguments-invalid", detail: `cannot resolve ${home.error.path}` }, enclosure });
  }
  const environment = hermeticGitEnvironment({ configHome: home.value, ambient: options.ambient });
  if (environment.outcome === "failed") {
    return creationFailed({ failure: { kind: "environment-unavailable", failure: environment.error }, enclosure });
  }
  const execution = options.execution({
    policy: {
      executable: "git",
      environment: () => environment.value,
      timeoutMilliseconds: undefined,
      maximumOutputBytes: 1048576,
    },
    ambientEnvironment: options.ambient,
  });
  const initialized = runGit({ execution, cwd: enclosure, arguments: ["init", "-q", "-b", "main", "--", repository.value] });
  if (initialized.outcome === "failed") return creationFailed({ failure: initialized.error, enclosure });
  const run: HermeticGitRepository["run"] = (command) => runGit({ execution, cwd: repository.value, ...command });
  return {
    outcome: "ok",
    value: {
      path: repository.value,
      environment: environment.value,
      run,
      writeFile: (write) => {
        const written = options.fileText.write({ path: options.path.join({ segments: [repository.value, write.relativePath] }), text: write.body });
        return written.outcome === "failed"
          ? { outcome: "failed", error: { kind: "file-unwritable", path: written.error.path, detail: written.error.detail } }
          : written;
      },
      commitAll: ({ message }) => {
        const added = run({ arguments: ["add", "-A"] });
        if (added.outcome === "failed") return added;
        const committed = run({ arguments: ["commit", "-q", "-m", message] });
        return committed.outcome === "failed" ? committed : { outcome: "ok", value: undefined };
      },
      dispose: allocated.value.dispose,
    },
  };
};
