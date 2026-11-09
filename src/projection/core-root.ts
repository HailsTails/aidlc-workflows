import { projectHostSurface } from "./application/project-host-surface.ts";
import { createSessionSkillSource } from "./adapters/session-skill-files.ts";
import { prepareLegacySkillTables } from "./adapters/legacy-skill-tables.ts";
import { projectMethodSkills } from "./application/project-method-skills.ts";
import { createCommandRenderers } from "./application/command-renderers.ts";
import type { SessionSkillTreeReader } from "./application/ports.ts";
import { shippedFormatDocuments } from "./adapters/legacy-format-docs.ts";
import { projectMethodAgents } from "./application/project-method-agents.ts";
import { legacyAgentModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
import { createHostSurfaceReader } from "./application/host-source-files.ts";
import { prepareLegacyRunners } from "./adapters/legacy-runners.ts";
import { serializeCompiledMethod } from "./adapters/compiled-method-file.ts";
import type { BuildProjection, HostFileReader, LegacyRunnerProcess, LegacyRunnerScratch } from "./application/ports.ts";

export const createBuildProjection = (request: {
  readonly hostFiles: HostFileReader;
  readonly sessionFiles: SessionSkillTreeReader;
  readonly runnerProcess: LegacyRunnerProcess;
  readonly runnerScratch: LegacyRunnerScratch;
  readonly runnerFrames: URL;
  readonly runnerChild: URL;
}): BuildProjection => ({
  projectHostSurface,
  serializeMethod: serializeCompiledMethod,
  readSessionSkills: (capture) => createSessionSkillSource({ ...capture, tree: request.sessionFiles }).read(),
  projectSkills: async (skills) => {
    const tables = await prepareLegacySkillTables(skills, { scratch: request.runnerScratch,
      processRunner: request.runnerProcess, frames: request.runnerFrames });
    return projectMethodSkills({ method: skills.method, sessions: skills.sessions,
      commands: createCommandRenderers({ source: skills.commands, place: skills.place }),
      skills: skills.render({ files: skills.files, prepare: skills.prepare, tokens: skills.tokens, tables }) });
  },
  projectAgents: (agents) => projectMethodAgents({ method: agents.method,
    harness: agents.render({ host: agents.host, files: agents.files, prepare: agents.prepare,
      channel: agents.channel, models: legacyAgentModelPolicy(agents.modelCap), formatDocuments: shippedFormatDocuments() }) }),
  readHostSources: (capture) => createHostSurfaceReader({ ...capture, reader: request.hostFiles }).read({ host: capture.host }),
  prepareCommandSource: (command) =>
    prepareLegacyRunners({ ...command, temporaryRoot: request.runnerFrames }, {
      scratch: request.runnerScratch, processRunner: request.runnerProcess, child: request.runnerChild,
    }),
});
