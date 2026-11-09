import { createHostSurfaceReader } from "./application/host-source-files.ts";
import { prepareLegacyRunners } from "./adapters/legacy-runners.ts";
import { serializeCompiledMethod } from "./adapters/compiled-method-file.ts";
import type { BuildProjection, HostFileReader, LegacyRunnerProcess, LegacyRunnerScratch } from "./application/ports.ts";

export const createBuildProjection = (request: {
  readonly hostFiles: HostFileReader;
  readonly runnerProcess: LegacyRunnerProcess;
  readonly runnerScratch: LegacyRunnerScratch;
  readonly runnerFrames: URL;
  readonly runnerChild: URL;
}): BuildProjection => ({
  serializeMethod: serializeCompiledMethod,
  readHostSources: (capture) => createHostSurfaceReader({ ...capture, reader: request.hostFiles }).read({ host: capture.host }),
  prepareCommandSource: (command) =>
    prepareLegacyRunners({ ...command, temporaryRoot: request.runnerFrames }, {
      scratch: request.runnerScratch, processRunner: request.runnerProcess, child: request.runnerChild,
    }),
});
