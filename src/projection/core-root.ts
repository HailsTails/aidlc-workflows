import { createAgentPersonaPreparer } from "./application/agent-persona.ts";
import { legacyMarkdownAgentSurface, legacyCliModelPolicy,
  legacyAgentTiersData, legacyAgentModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
import { extendedSubprocessTimeoutMs } from "./adapters/legacy-runtime-budget.ts";
import { createLegacyNativeCommands, legacyHookTrustHash } from "./adapters/legacy-trusted-commands.ts";
import { createNeutralReading } from "./adapters/neutral-surface-files.ts";
import { projectMethodDocuments } from "./application/project-method-documents.ts";
import { legacyDispatcherRoutes, createCopyChannelAllowSource } from "./adapters/legacy-dispatcher.ts";
import { projectMethodSettings } from "./application/project-method-settings.ts";
import { projectRuntime } from "./application/project-runtime.ts";
import { projectWorkspace } from "./application/project-workspace.ts";
import { createRuntimeReading } from "./adapters/runtime-files.ts";
import { createMemoryCompanionReading } from "./adapters/memory-companion-files.ts";
import { legacySettingsSchemaData } from "./adapters/legacy-settings-schema.ts";
import { createHostSurfaceProjection } from "./application/project-host-surface.ts";
import { createHostSurfaceMembers } from "./application/host-surface-members.ts";
import { delegateShellFacts } from "./adapters/delegate-shell-facts.ts";
import { createSessionSkillSource } from "./adapters/session-skill-files.ts";
import { prepareLegacySkillTables, prepareCapturedLegacyFormatting } from "./adapters/legacy-skill-tables.ts";
import { projectMethodSkills } from "./application/project-method-skills.ts";
import { createCommandRenderers, collectCommandRenderings } from "./application/command-renderers.ts";
import type { SessionSkillTreeReader } from "./application/ports/skills.ts";
import { shippedFormatDocuments, delegatedSharedKnowledge } from "./adapters/legacy-format-docs.ts";
import { projectMethodAgents } from "./application/project-method-agents.ts";
import { createHostSurfaceReader } from "./application/host-source-files.ts";
import { prepareLegacyRunners } from "./adapters/legacy-runners.ts";
import { serializeCompiledMethod } from "./adapters/compiled-method-file.ts";
import { createProjectMethodForHarness } from "./application/project-method-for-harness.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { BuildProjection } from "./application/ports/build-projection.ts";
import type { HostFileReader } from "./application/ports/host-sources.ts";
import type { LegacyRunnerProcess, LegacyRunnerScratch } from "./application/ports/legacy-runner.ts";
import type { AgentProjectionRequest, AgentRenderingInputs } from "./application/ports/agents.ts";
import type { SettingsCapabilities, SettingsProjectionRequest, SettingsRenderingInputs } from "./application/ports/settings.ts";
import type { CopyChannelAllows, CopyChannelAllowSource } from "./application/ports/copy-channel.ts";
import type { HarnessAssembly, HarnessAssemblyRequest } from "./application/ports/harness-assembly.ts";
import type { DelegateShellFacts } from "./application/ports/delegate-shell.ts";
import type { HostedHarness, Harness } from "./application/ports/harness.ts";
import type { SkillTableRenderer } from "./domain/neutral-surface.ts";
import type { CommandSource } from "./application/ports/commands.ts";

const agentInputs = ({ agents, allows, facts }: {
  readonly agents: AgentProjectionRequest; readonly allows: CopyChannelAllows; readonly facts: DelegateShellFacts;
}): AgentRenderingInputs => {
  const persona = createAgentPersonaPreparer({ sources: agents.sources, tokens: agents.tokens,
    directory: agents.host.directory, rulesFolder: agents.rulesFolder, reviewerAgents: agents.reviewerAgents,
    sharedKnowledge: delegatedSharedKnowledge(agents.host.directory) });
  const markdown = legacyMarkdownAgentSurface({ host: agents.host, cap: agents.modelCap });
  return { host: agents.host, files: agents.files, prepare: agents.prepare, tokens: agents.tokens, persona,
    documents: (request) => {
      const prepared = persona(request);
      return prepared.ok ? markdown({ ...request, content: prepared.value }) : prepared;
    }, modelCap: agents.modelCap, method: agents.method, channel: agents.channel,
    models: legacyAgentModelPolicy(agents.modelCap), formatDocuments: shippedFormatDocuments(), allows, delegateShellFacts: facts };
};

const settingsInputs = ({ settings, allows, capabilities }: {
  readonly settings: SettingsProjectionRequest; readonly allows: CopyChannelAllows;
  readonly capabilities: SettingsCapabilities;
}): SettingsRenderingInputs => ({ files: settings.files, prepare: settings.prepare,
  tokens: settings.tokens, channel: settings.channel, entrypoints: settings.entrypoints, allows,
  ...capabilities, cliModels: legacyCliModelPolicy(settings.modelCap),
  });

const assembledMembers = ({ assembly, surface, rulesFolder, commands: source, allows, facts, capabilities, tables }: {
  readonly assembly: HarnessAssemblyRequest;
  readonly surface: Pick<Harness, "renderHostData" | "placeAuthoredFile">;
  readonly rulesFolder: string | null; readonly commands: CommandSource;
  readonly allows: CopyChannelAllows; readonly facts: DelegateShellFacts; readonly capabilities: SettingsCapabilities;
  readonly tables: SkillTableRenderer;
}): Harness => {
  const commands = createCommandRenderers({ source, place: assembly.renderers.commandPlacement });
  const skills = assembly.renderers.skills({ files: assembly.files, prepare: assembly.prepare,
    tokens: assembly.tokens, tables });
  return { tokens: assembly.tokens,
    ...assembly.renderers.agents(agentInputs({ agents: { ...assembly,
      render: assembly.renderers.agents, rulesFolder }, allows, facts })),
    ...assembly.renderers.settings(settingsInputs({ settings: { ...assembly,
      render: assembly.renderers.settings }, allows, capabilities })),
    ...assembly.renderers.documents({ fills: assembly.fills, tokens: assembly.tokens,
      bindingHeadings: assembly.bindingHeadings }),
    ...surface,
    deriveFiles: assembly.renderers.derive ?? (() => accepted([])),
    renderStageCommand: commands.renderStageCommand, renderScopeCommand: commands.renderScopeCommand,
    renderSessionSkill: skills.renderSessionSkill,
    renderOrchestratorSkill: (entry) => collectCommandRenderings([
      commands.renderOrchestratorSkill(entry), skills.renderOrchestratorSkill(entry),
    ]),
  };
};

const harnessAssembler = (ports: {
  readonly allows: CopyChannelAllowSource; readonly facts: DelegateShellFacts; readonly capabilities: SettingsCapabilities;
  readonly scratch: LegacyRunnerScratch; readonly processRunner: LegacyRunnerProcess;
  readonly frames: URL; readonly child: URL;
}): HarnessAssembly => async (assembly) => {
  const reading = ports.allows.read();
  if (!reading.ok) return refused([reading.refusal]);
  const runtime = projectRuntime({ host: assembly.host, runtime: assembly.runtime,
    compiled: assembly.compiled, tokens: assembly.tokens });
  if (!runtime.ok) return refused([runtime.refusal]);
  const hostData = assembly.renderers.data({ delegateShellFacts: ports.facts });
  const surface = createHostSurfaceMembers({ ...assembly, data: hostData,
    placements: assembly.renderers.placements });
  const descriptor = surface.renderHostData();
  if (!descriptor.ok) return refused([descriptor.refusal]);
  const formatting = await prepareCapturedLegacyFormatting({ ...assembly,
    harnessDir: assembly.host.directory, harnessName: assembly.host.distribution,
    files: [...runtime.value, ...descriptor.value] }, ports);
  return formatting.ok ? accepted(assembledMembers({ assembly, surface, rulesFolder: hostData.rulesFolder,
    allows: reading.value, facts: ports.facts, capabilities: ports.capabilities, ...formatting.value })) : refused([formatting.refusal]);
};

export const createHostedMethodProjection = (hosted: HostedHarness) => createProjectMethodForHarness({
  find: (id) => id === hosted.host.distribution ? accepted(hosted) : refused({ kind: "unknown-harness", harness: id }),
  all: () => [hosted],
});

export const createBuildProjection = (request: {
  readonly hostFiles: HostFileReader; readonly sessionFiles: SessionSkillTreeReader;
  readonly runnerProcess: LegacyRunnerProcess; readonly runnerScratch: LegacyRunnerScratch;
  readonly runnerFrames: URL; readonly runnerChild: URL;
}): BuildProjection => {
  const allows = createCopyChannelAllowSource();
  const facts = delegateShellFacts();
  const settingsCapabilities: SettingsCapabilities = {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs(), hookTrust: legacyHookTrustHash };
  return {
    delegateShellFacts: facts, settingsCapabilities, nativeCommands: createLegacyNativeCommands(legacyDispatcherRoutes()),
    assembleHarness: harnessAssembler({ allows, facts, capabilities: settingsCapabilities, scratch: request.runnerScratch,
      processRunner: request.runnerProcess, frames: request.runnerFrames, child: request.runnerChild }),
    projectWorkspace,
    projectSettings: (settings) => {
      const reading = allows.read();
      return reading.ok ? projectMethodSettings({ method: settings.method,
        harness: settings.render(settingsInputs({ settings, allows: reading.value,
          capabilities: settingsCapabilities })) }) : reading;
    },
    projectRuntime, readMemoryCompanions: createMemoryCompanionReading(request.sessionFiles),
    readNeutral: createNeutralReading({ files: request.hostFiles, tree: request.sessionFiles }),
    projectDocuments: projectMethodDocuments,
    readRuntime: createRuntimeReading({ tree: request.sessionFiles,
      agentTiers: legacyAgentTiersData, settingsSchema: legacySettingsSchemaData }),
    projectHostSurface: createHostSurfaceProjection(facts), serializeMethod: serializeCompiledMethod,
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
      return reading.ok ? projectMethodAgents({ method: agents.method,
        harness: agents.render(agentInputs({ agents, allows: reading.value, facts })) }) : reading;
    },
    readHostSources: (capture) => createHostSurfaceReader({ ...capture, reader: request.hostFiles }).read({ host: capture.host }),
    prepareCommandSource: (command) => prepareLegacyRunners({ ...command, temporaryRoot: request.runnerFrames }, {
      scratch: request.runnerScratch, processRunner: request.runnerProcess, child: request.runnerChild,
    }),
  };
};
