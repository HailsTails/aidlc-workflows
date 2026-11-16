import type { Result } from "../values/result.ts";
import type { EmbeddedRunner } from "./embedded-runner-module-schema.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type { StandaloneRunner } from "./runner-module-schema.ts";
import type { NativeException } from "./runner-result-schema.ts";

type ToolchainLoad<Toolchain> = Promise<Result<Toolchain, RunnerFailure>>;

const withToolchain = <Toolchain, Value>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly act: (toolchain: Toolchain) => Promise<Result<Value, RunnerFailure>>;
}): Promise<Result<Value, RunnerFailure>> =>
  request.toolchain.then((loaded) => (loaded.outcome === "failed" ? loaded : request.act(loaded.value)));

export const toolchainBoundStandaloneRunner = <Toolchain>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly runnerOf: (toolchain: Toolchain) => StandaloneRunner;
}): StandaloneRunner => ({
  exceptionPath: "standalone",
  run: (run) => withToolchain({ toolchain: request.toolchain, act: (toolchain) => request.runnerOf(toolchain).run(run) }),
  conform: (conform) =>
    withToolchain({ toolchain: request.toolchain, act: (toolchain) => request.runnerOf(toolchain).conform(conform) }),
});

export const toolchainBoundEmbeddedRunner = <Toolchain>(request: {
  readonly toolchain: ToolchainLoad<Toolchain>;
  readonly projectedKinds: readonly NativeException["kind"][];
  readonly runnerOf: (toolchain: Toolchain) => EmbeddedRunner;
}): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: request.projectedKinds,
  run: (run) => withToolchain({ toolchain: request.toolchain, act: (toolchain) => request.runnerOf(toolchain).run(run) }),
  conform: (conform) =>
    withToolchain({ toolchain: request.toolchain, act: (toolchain) => request.runnerOf(toolchain).conform(conform) }),
  project: (project) =>
    withToolchain({ toolchain: request.toolchain, act: (toolchain) => request.runnerOf(toolchain).project(project) }),
});
