import { createAgentPersonaPreparer } from "./application/agent-persona.ts";
import type { PluginProjector } from "./application/ports/plugins.ts";
import { legacyAgentDocumentModel, legacyCliModelPolicy,
  legacyAgentTiersData, legacyAgentModelPolicy } from "./adapters/legacy-agent-surfaces.ts";
import { extendedSubprocessTimeoutMs } from "./adapters/legacy-runtime-budget.ts";
import { createLegacyNativeCommands } from "./adapters/legacy-trusted-commands.ts";
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
import type { NativeCommandRoutes } from "./domain/native-command.ts";
import type { CapturedFileFrame } from "./application/ports/captured-file-frame.ts";
import { createCapturedFileFrame, CAPTURED_FRAME_NATIVE_PATH } from "./adapters/captured-file-frame.ts";

export { captureBuildSources } from "./application/capture-build-sources.ts";
export { createPluginAuthoringEnrichment } from "./application/enrich-plugin-authoring.ts";
export { createCapturedMethodCompiler } from "./application/compile-captured-method.ts";
export { createProjectCapturedHost } from "./application/project-captured-host.ts";
export { createPluginBuildSession } from "./application/plugin-build-session.ts";
export { renderFrozenCommandSet } from "./application/render-frozen-command-set.ts";
export { duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments } from "./application/legacy-command-plan.ts";
export { captureReleaseEntrypoints } from "./application/release-entrypoints.ts";

const agentInputs = ({ agents, allows, facts }: {
  readonly agents: AgentProjectionRequest; readonly allows: CopyChannelAllows; readonly facts: DelegateShellFacts;
}): AgentRenderingInputs => {
  const persona = createAgentPersonaPreparer({ sources: agents.sources, tokens: agents.tokens,
    directory: agents.host.directory, rulesFolder: agents.rulesFolder, reviewerAgents: agents.reviewerAgents,
    sharedKnowledge: delegatedSharedKnowledge(agents.host.directory) });
  const model = legacyAgentDocumentModel({ flavor: agents.tierFlavor, cap: agents.modelCap });
  return { host: agents.host, files: agents.files, prepare: agents.prepare, tokens: agents.tokens, persona,
    documents: (request) => {
      const prepared = persona(request);
      if (!prepared.ok) return prepared;
      const projected = model(request);
      return projected.ok ? request.render({ agent: request.agent.slug, content: prepared.value,
        model: projected.value }) : projected;
    }, modelCap: agents.modelCap, tierFlavor: agents.tierFlavor, method: agents.method, channel: agents.channel,
    models: legacyAgentModelPolicy({ flavor: agents.tierFlavor, cap: agents.modelCap }), formatDocuments: shippedFormatDocuments(), allows, delegateShellFacts: facts };
};

const settingsInputs = ({ settings, allows, capabilities, nativeCommands }: {
  readonly settings: SettingsProjectionRequest; readonly allows: CopyChannelAllows;
  readonly capabilities: SettingsCapabilities;
  readonly nativeCommands: NativeCommandRoutes;
}): SettingsRenderingInputs => ({ files: settings.files, prepare: settings.prepare,
  tokens: settings.tokens, channel: settings.channel, entrypoints: settings.entrypoints, allows,
  ...capabilities, nativeCommands, cliModels: legacyCliModelPolicy(settings.modelCap),
  });

const assembledMembers = ({ assembly, surface, rulesFolder, commands: source, allows, facts, capabilities, tables,
  nativeCommands, frame }: {
  readonly assembly: HarnessAssemblyRequest;
  readonly surface: Pick<Harness, "renderHostData" | "placeAuthoredFile">;
  readonly rulesFolder: string | null; readonly commands: CommandSource;
  readonly allows: CopyChannelAllows; readonly facts: DelegateShellFacts; readonly capabilities: SettingsCapabilities;
  readonly tables: SkillTableRenderer;
  readonly nativeCommands: NativeCommandRoutes;
  readonly frame: CapturedFileFrame;
}): Harness => {
  const commands = createCommandRenderers({ source, place: assembly.renderers.commandPlacement });
  const skills = assembly.renderers.skills({ files: assembly.files, prepare: assembly.prepare,
    tokens: assembly.tokens, tables });
  return { tokens: assembly.tokens,
    ...assembly.renderers.agents(agentInputs({ agents: { ...assembly,
      render: assembly.renderers.agents, rulesFolder }, allows, facts })),
    ...assembly.renderers.settings(settingsInputs({ settings: { ...assembly,
      render: assembly.renderers.settings }, allows, capabilities, nativeCommands })),
    ...assembly.renderers.documents({ fills: assembly.fills, tokens: assembly.tokens,
      bindingHeadings: assembly.bindingHeadings }),
    ...surface,
    deriveFiles: (request) => assembly.renderers.derive?.({ ...request, frame }) ?? accepted([]),
    renderStageCommand: commands.renderStageCommand, renderScopeCommand: commands.renderScopeCommand,
    renderSessionSkill: skills.renderSessionSkill,
    renderOrchestratorSkill: (entry) => collectCommandRenderings([
      commands.renderOrchestratorSkill(entry), skills.renderOrchestratorSkill(entry),
    ]),
  };
};

const harnessAssembler = (ports: {
  readonly frame: CapturedFileFrame;
  readonly nativeCommands: NativeCommandRoutes;
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
    record: assembly.renderers.record,
    placements: assembly.renderers.placements });
  const descriptor = surface.renderHostData();
  if (!descriptor.ok) return refused([descriptor.refusal]);
  const formatting = await prepareCapturedLegacyFormatting({ ...assembly,
    harnessDir: assembly.host.directory, harnessName: assembly.host.distribution,
    files: [...runtime.value, ...descriptor.value] }, ports);
  return formatting.ok ? accepted(assembledMembers({ assembly, surface, rulesFolder: hostData.rulesFolder,
    allows: reading.value, facts: ports.facts, capabilities: ports.capabilities,
    nativeCommands: ports.nativeCommands, frame: ports.frame, ...formatting.value })) : refused([formatting.refusal]);
};

export const createHostedMethodProjection = (hosted: HostedHarness) => createProjectMethodForHarness({
  find: (id) => id === hosted.host.distribution ? accepted(hosted) : refused({ kind: "unknown-harness", harness: id }),
  all: () => [hosted],
});

export const createBuildProjection = (request: {
  readonly hostFiles: HostFileReader; readonly sessionFiles: SessionSkillTreeReader;
  readonly runnerProcess: LegacyRunnerProcess; readonly runnerScratch: LegacyRunnerScratch;
  readonly runnerFrames: URL; readonly runnerChild: URL;
  readonly plugins: PluginProjector;
}): BuildProjection => {
  const allows = createCopyChannelAllowSource();
  const nativeCommands = createLegacyNativeCommands(legacyDispatcherRoutes());
  const facts = { ...delegateShellFacts(), engineNamespace: nativeCommands.namespace,
    trustedCommand: nativeCommands.trusted };
  const settingsCapabilities: SettingsCapabilities = {
    extendedSubprocessTimeoutMs: extendedSubprocessTimeoutMs() };
  return {
    plugins: request.plugins,
    delegateShellFacts: facts, settingsCapabilities, nativeCommands,
    assembleHarness: harnessAssembler({ allows, facts, nativeCommands,
      frame: createCapturedFileFrame({ scratch: request.runnerScratch, frames: request.runnerFrames,
        nativePath: CAPTURED_FRAME_NATIVE_PATH }),
      capabilities: settingsCapabilities, scratch: request.runnerScratch,
      processRunner: request.runnerProcess, frames: request.runnerFrames, child: request.runnerChild }),
    projectWorkspace,
    projectSettings: (settings) => {
      const reading = allows.read();
      return reading.ok ? projectMethodSettings({ method: settings.method,
        harness: settings.render(settingsInputs({ settings, allows: reading.value,
          capabilities: settingsCapabilities, nativeCommands })) }) : reading;
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
