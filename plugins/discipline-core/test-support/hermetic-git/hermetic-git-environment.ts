import { defaultExecutionEnvironmentSnapshot, type ExecutionEnvironment, type ExecutionFailure } from "../../core/platform-ports/execution-port.ts";
import type { AbsolutePath } from "../../core/values/absolute-path.ts";
import type { Result } from "../../core/values/result.ts";

export type HermeticGitEnvironment = Readonly<Record<string, string>>;

export const CHECKOUT_BINDING_GIT_VARIABLES: readonly [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX",
  "GIT_NAMESPACE", "GIT_GRAFT_FILE", "GIT_INDEX_VERSION", "GIT_CEILING_DIRECTORIES",
] = [
  "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_PREFIX",
  "GIT_NAMESPACE", "GIT_GRAFT_FILE", "GIT_INDEX_VERSION", "GIT_CEILING_DIRECTORIES",
];

export const withoutInheritedGitBindings = (request: {
  readonly ambient: ExecutionEnvironment;
}): HermeticGitEnvironment => {
  const retained: Record<string, string> = {};
  Object.entries(request.ambient).forEach(([variableName, variableValue]) => {
    if (variableValue === undefined || CHECKOUT_BINDING_GIT_VARIABLES.some((binding) => binding === variableName)) return;
    retained[variableName] = variableValue;
  });
  return retained;
};

export const hermeticGitEnvironment = (request: {
  readonly configHome: AbsolutePath;
  readonly ambient?: ExecutionEnvironment;
}): Result<HermeticGitEnvironment, ExecutionFailure> => {
  const ambient: Result<ExecutionEnvironment, ExecutionFailure> = request.ambient === undefined
    ? defaultExecutionEnvironmentSnapshot({})
    : { outcome: "ok", value: request.ambient };
  if (ambient.outcome === "failed") return ambient;
  return {
    outcome: "ok",
    value: {
      ...withoutInheritedGitBindings({ ambient: ambient.value }),
      HOME: request.configHome,
      USERPROFILE: request.configHome,
      GIT_CONFIG_GLOBAL: `${request.configHome}/.gitconfig`,
      GIT_CONFIG_SYSTEM: `${request.configHome}/.gitconfig-system`,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "Hermetic Fixture",
      GIT_AUTHOR_EMAIL: "hermetic@fixture.invalid",
      GIT_COMMITTER_NAME: "Hermetic Fixture",
      GIT_COMMITTER_EMAIL: "hermetic@fixture.invalid",
    },
  };
};
