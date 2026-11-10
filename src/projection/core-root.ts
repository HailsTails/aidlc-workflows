import { createAgentPersonaPreparer } from "./application/agent-persona.ts";
import { inlineAgentSet } from "../workflow-definition/domain/method-participation.ts";
import { legacyMarkdownAgentSurface, legacyTomlAgentModels } from "./adapters/legacy-agent-surfaces.ts";
import { extendedSubprocessTimeoutMs } from "./adapters/legacy-runtime-budget.ts";
import { legacyHookTrustHash } from "./adapters/legacy-trusted-commands.ts";
import { legacyCliModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
import { createNeutralReading } from "./adapters/neutral-surface-files.ts";
import { projectMethodDocuments } from "./application/project-method-documents.ts";
import { createCopyChannelAllowSource } from "./adapters/legacy-dispatcher.ts";
import { projectMethodSettings } from "./application/project-method-settings.ts";
import { projectRuntime } from "./application/project-runtime.ts";
import { createRuntimeReading } from "./adapters/runtime-files.ts";
import { legacyAgentTiersData } from "./adapters/legacy-agent-surfaces.ts";
import { legacySettingsSchemaData } from "./adapters/legacy-settings-schema.ts";
import { createHostSurfaceProjection } from "./application/project-host-surface.ts";
import { legacyDelegateShellPolicy } from "./adapters/legacy-delegate-shell.ts";
import { createSessionSkillSource } from "./adapters/session-skill-files.ts";
import { prepareLegacySkillTables } from "./adapters/legacy-skill-tables.ts";
import { projectMethodSkills } from "./application/project-method-skills.ts";
import { createCommandRenderers } from "./application/command-renderers.ts";
import type { SessionSkillTreeReader } from "./application/ports/skills.ts";
import { shippedFormatDocuments, delegatedSharedKnowledge } from "./adapters/legacy-format-docs.ts";
import { projectMethodAgents } from "./application/project-method-agents.ts";
import { legacyAgentModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
import { createHostSurfaceReader } from "./application/host-source-files.ts";
import { prepareLegacyRunners } from "./adapters/legacy-runners.ts";
import { serializeCompiledMethod } from "./adapters/compiled-method-file.ts";
import type { BuildProjection } from "./application/ports/build-projection.ts";
import type { HostFileReader } from "./application/ports/host-sources.ts";
import type { LegacyRunnerProcess, LegacyRunnerScratch } from "./application/ports/legacy-runner.ts";

export const createBuildProjection = (request: {
  readonly hostFiles: HostFileReader;
  readonly sessionFiles: SessionSkillTreeReader;
  readonly runnerProcess: LegacyRunnerProcess;
  readonly runnerScratch: LegacyRunnerScratch;
  readonly runnerFrames: URL;
  readonly runnerChild: URL;
}): BuildProjection => {
  const allows = createCopyChannelAllowSource();
  const timeoutMs = extendedSubprocessTimeoutMs();
  return {
    projectSettings: (settings) => {
      const reading = allows.read();
      if (!reading.ok) return reading;
      const harness = settings.render({ files: settings.files, prepare: settings.prepare,
        tokens: settings.tokens, channel: settings.channel, entrypoints: settings.entrypoints, allows: reading.value,
        extendedSubprocessTimeoutMs: timeoutMs, hookTrust: legacyHookTrustHash,
        cliModels: legacyCliModelPolicy(settings.modelCap) });
      return projectMethodSettings({ method: settings.method, harness });
    },
    projectRuntime,
    readNeutral: createNeutralReading({ files: request.hostFiles, tree: request.sessionFiles }),
    projectDocuments: projectMethodDocuments,
    readRuntime: createRuntimeReading({ tree: request.sessionFiles,
      agentTiers: legacyAgentTiersData, settingsSchema: legacySettingsSchemaData }),
    projectHostSurface: createHostSurfaceProjection(legacyDelegateShellPolicy),
    serializeMethod: serializeCompiledMethod,
    readSessionSkills: (capture) => createSessionSkillSource({ ...capture, tree: request.sessionFiles }).read(),
    projectSkills: async (skills) => {
      const tables = await prepareLegacySkillTables(skills, { scratch: request.runnerScratch,
        processRunner: request.runnerProcess, frames: request.runnerFrames });
      return projectMethodSkills({ method: skills.method, sessions: skills.sessions,
        commands: createCommandRenderers({ source: skills.commands, place: skills.place }),
        skills: skills.render({ files: skills.files, prepare: skills.prepare, tokens: skills.tokens, tables }) });
    },
    projectAgents: (agents) => {
      const reading = allows.read();
      if (!reading.ok) return reading;
      const persona = createAgentPersonaPreparer({ sources: agents.sources, tokens: agents.tokens,
        directory: agents.host.directory, reviewerAgents: agents.reviewerAgents,
        sharedKnowledge: delegatedSharedKnowledge(agents.host.directory) });
      const markdown = legacyMarkdownAgentSurface({ host: agents.host, cap: agents.modelCap });
      return projectMethodAgents({ method: agents.method,
        harness: agents.render({ host: agents.host, files: agents.files, prepare: agents.prepare,
        tokens: agents.tokens, persona, documents: (request) => {
          const prepared = persona(request);
          return prepared.ok ? markdown({ ...request, content: prepared.value }) : prepared;
        }, tomlModels: legacyTomlAgentModels({ host: agents.host, cap: agents.modelCap }),
        inlineAgents: inlineAgentSet(agents.method),
        channel: agents.channel, models: legacyAgentModelPolicy(agents.modelCap),
        formatDocuments: shippedFormatDocuments(), allows: reading.value }) });
    },
    readHostSources: (capture) => createHostSurfaceReader({ ...capture, reader: request.hostFiles }).read({ host: capture.host }),
    prepareCommandSource: (command) =>
      prepareLegacyRunners({ ...command, temporaryRoot: request.runnerFrames }, {
        scratch: request.runnerScratch, processRunner: request.runnerProcess, child: request.runnerChild,
      }),
  };
};
