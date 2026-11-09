import { shippedFormatDocuments } from "./adapters/legacy-format-docs.ts";
import { projectMethodAgents } from "./application/project-method-agents.ts";
import { legacyAgentModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
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
  projectAgents: (agents) => projectMethodAgents({ method: agents.method,
    harness: agents.render({ host: agents.host, files: agents.files, prepare: agents.prepare,
      channel: agents.channel, models: legacyAgentModelPolicy(agents.modelCap), formatDocuments: shippedFormatDocuments() }) }),
  readHostSources: (capture) => createHostSurfaceReader({ ...capture, reader: request.hostFiles }).read({ host: capture.host }),
  prepareCommandSource: (command) =>
    prepareLegacyRunners({ ...command, temporaryRoot: request.runnerFrames }, {
      scratch: request.runnerScratch, processRunner: request.runnerProcess, child: request.runnerChild,
    }),
});
