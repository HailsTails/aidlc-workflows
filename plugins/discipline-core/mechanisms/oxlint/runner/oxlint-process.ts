import { createDefaultExecutionPort, type ExecutionExit, type ExecutionFailure, type ExecutionPort } from "../../../core/platform-ports/execution-port.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import type { Result } from "../../../core/values/result.ts";

export type OxlintProcessPort = {
  readonly run: (request: {
    readonly arguments: readonly string[];
    readonly cwd: AbsolutePath;
  }) => Result<ExecutionExit, ExecutionFailure>;
};

export const createOxlintProcessPort = (options: {
  readonly execution: ExecutionPort;
  readonly cliEntry: AbsolutePath;
}): OxlintProcessPort => ({
  run: (request) => options.execution.run({
    arguments: [options.cliEntry, ...request.arguments],
    cwd: request.cwd,
  }),
});

export const createDefaultOxlintProcessPort = (options: {
  readonly cliEntry: AbsolutePath;
  readonly nodeExecutable?: AbsolutePath;
}): OxlintProcessPort => createOxlintProcessPort({
  cliEntry: options.cliEntry,
  execution: createDefaultExecutionPort({
    policy: {
      executable: options.nodeExecutable ?? "node",
      environment: ({ ambient }) => ({ ...ambient }),
      timeoutMilliseconds: 60_000,
      maximumOutputBytes: 16 * 1024 * 1024,
    },
  }),
});
