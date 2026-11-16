import type { Result } from "../values/result.ts";
import type { EmbeddedRunner } from "./embedded-runner-module-schema.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type { StandaloneRunner } from "./runner-module-schema.ts";
import type { NativeException } from "./runner-result-schema.ts";

type ToolchainLoad<Loaded> = Promise<Result<Loaded, RunnerFailure>>;

const builtOnce = <Toolchain, Runner>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly runnerOf: (toolchain: Toolchain) => Runner;
}): ToolchainLoad<Runner> =>
  request.toolchain.then((loaded) => (loaded.outcome === "failed" ? loaded : { outcome: "ok", value: request.runnerOf(loaded.value) }));

const withRunner = <Runner, Value>(request: {
  readonly runner: ToolchainLoad<Runner>;
  readonly act: (runner: Runner) => Promise<Result<Value, RunnerFailure>>;
}): Promise<Result<Value, RunnerFailure>> =>
  request.runner.then((built) => (built.outcome === "failed" ? built : request.act(built.value)));

export const toolchainBoundStandaloneRunner = <Toolchain>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly runnerOf: (toolchain: Toolchain) => StandaloneRunner;
}): StandaloneRunner => {
  const runner = builtOnce(request);
  return {
    exceptionPath: "standalone",
    run: (run) => withRunner({ runner, act: (built) => built.run(run) }),
    conform: (conform) => withRunner({ runner, act: (built) => built.conform(conform) }),
  };
};

export const toolchainBoundEmbeddedRunner = <Toolchain>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly runnerOf: (toolchain: Toolchain) => EmbeddedRunner;
}): EmbeddedRunner => {
  const runner = builtOnce(request);
  return {
    exceptionPath: "embedded",
    projectedKinds: request.projectedKinds,
    run: (run) => withRunner({ runner, act: (built) => built.run(run) }),
    conform: (conform) => withRunner({ runner, act: (built) => built.conform(conform) }),
    project: (project) => withRunner({ runner, act: (built) => built.project(project) }),
  };
};
