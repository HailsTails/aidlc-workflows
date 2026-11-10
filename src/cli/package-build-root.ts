import { createBuildPackaging } from "../packaging/core-root.ts";
import { DEFAULT_WORKSPACE } from "../projection/domain/workspace.ts";
import type { MemoryCompanion, SharedRuntime } from "../projection/domain/neutral-surface.ts";
import type { VersionStamp } from "../projection/application/ports/runtime.ts";
import type { ProjectDocuments } from "./roots.ts";
import type { NeutralSurface } from "../projection/domain/neutral-surface.ts";
import type { SessionSkill } from "../projection/domain/neutral-surface.ts";
import type { BuildProjection } from "../projection/application/ports/build-projection.ts";
import { hostAgentMembers, hostSkillMembers, hostSkillInputs, hostSurfaceMembers,
  hostSettingsInputs, hostSettingsMembers, hostDocumentMembers, hostBindingHeadings } from "./host-table.ts";
import { accepted, refused } from "../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal } from "../kernel/values.ts";
import type { Result } from "../kernel/result.ts";
import { createAuthoredMethodLoading } from "../workflow-definition/core-root.ts";
import type { AuthoredCoreMethod, MethodReading } from "../workflow-definition/application/ports.ts";
import { createBuildProjection, createHostedMethodProjection } from "../projection/core-root.ts";
import type { CompiledMethodFiles } from "../projection/domain/projection.ts";
import type { CoreBuild, CoreBuildTarget, CreatePackageBuildRoot,
  CapturedHostSources, HostSourcesRequest, HostBuildTable, ReadHostDistribution, ProjectHost } from "./roots.ts";
import type { ProjectionRefusal } from "../projection/domain/projection.ts";

const projectFor = (request: { readonly authored: AuthoredCoreMethod; readonly target: CoreBuildTarget },
  serializeMethod: BuildProjection["serializeMethod"]):
    Result<CompiledMethodFiles, KernelRefusal> => {
    const { authored, target } = request;
    const distribution = distributionId(target.name);
    if (!distribution.ok) return distribution;
    const directory = projectPath(target.directory);
    if (!directory.ok) return directory;
    const memoryRoot = projectPath(target.memoryRoot);
    return memoryRoot.ok ? accepted(serializeMethod({ method: authored.method,
      host: { distribution: distribution.value, directory: directory.value }, memoryRoot: memoryRoot.value }))
      : memoryRoot;
  };


const captureHost = async (capture: HostSourcesRequest,
  projection: Pick<BuildProjection, "readHostSources">):
    Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>> => {
    const distribution = distributionId(capture.name);
    if (!distribution.ok) return refused([distribution.refusal]);
    const directory = projectPath(capture.directory);
    if (!directory.ok) return refused([directory.refusal]);
    const host = { distribution: distribution.value, directory: directory.value };
    const surface = hostSurfaceMembers(host);
    const required = [...capture.required, ...hostSkillInputs(capture.name), ...hostSettingsInputs(capture.name),
      ...(surface?.placements.map((placement) => placement.source) ?? [])];
    const paths = [...new Set([...capture.copied, ...required])].map(sourcePath);
    const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
    if (failures.length > 0) return refused(failures);
    const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
    const files = await projection.readHostSources({ root: capture.root, host, sources,
      required: sources.filter((path) => required.includes(path)) });
    return files.ok ? accepted({ host, files: files.value }) : files;
  };


type SessionReading = () => Promise<Result<readonly SessionSkill[], readonly ProjectionRefusal[]>>;
type CoreNeutralCapture = (core: CoreBuild) => Promise<Result<NeutralSurface, readonly ProjectionRefusal[]>>;

const sessionReading = (request: { readonly projection: BuildProjection; readonly core: URL }): SessionReading => {
  let captured: ReturnType<SessionReading> | undefined;
  return () => {
    const source = sourcePath("skills");
    return source.ok ? captured ??= request.projection.readSessionSkills({ source: source.value,
      folder: new URL("skills/", request.core) }) : Promise.resolve(refused([{
        kind: "render-failed", concept: "session-skill", name: "skills", reason: "The session source path is invalid.",
      }]));
  };
};

const neutralReading = (request: { readonly projection: BuildProjection; readonly core: URL }): CoreNeutralCapture => {
  let captured: ReturnType<CoreNeutralCapture> | undefined;
  return (core) => captured ??= request.projection.readNeutral({ core: request.core, sources: core.sources });
};

const documentsProjector = (request: {
  readonly projection: BuildProjection; readonly readNeutral: CoreNeutralCapture;
}): ProjectDocuments => async (documents) => {
  const members = hostDocumentMembers(documents.host);
  if (members === null) return accepted([]);
  const surface = await request.readNeutral(documents.core);
  if (!surface.ok) return surface;
  const rendered = request.projection.projectDocuments({ method: documents.core.method,
    host: documents.host, render: members.render, surface: surface.value,
    fills: documents.fills, tokens: documents.tokens, bindingHeadings: hostBindingHeadings() });
  return rendered.ok ? rendered : refused([rendered.refusal]);
};

type FullHostCapture = {
  readonly surface: NeutralSurface; readonly runtime: SharedRuntime; readonly companions: readonly MemoryCompanion[];
};
type CaptureFullHost = (core: CoreBuild) => Promise<Result<FullHostCapture, readonly ProjectionRefusal[]>>;

const fullHostCapture = (ports: {
  readonly projection: BuildProjection; readonly core: URL; readonly stamp: VersionStamp;
  readonly readSessions: SessionReading; readonly readNeutral: CoreNeutralCapture;
}): CaptureFullHost => {
  let runtime: Promise<Result<SharedRuntime, readonly ProjectionRefusal[]>> | undefined;
  let companions: Promise<Result<readonly MemoryCompanion[], readonly ProjectionRefusal[]>> | undefined;
  return async (core) => {
    const neutral = await ports.readNeutral(core);
    if (!neutral.ok) return neutral;
    const sessions = await ports.readSessions();
    if (!sessions.ok) return sessions;
    const captured = await (runtime ??= ports.projection.readRuntime({ core: ports.core,
      method: core.method, stamp: ports.stamp }));
    if (!captured.ok) return captured;
    const memory = await (companions ??= ports.projection.readMemoryCompanions({ core: ports.core }));
    return memory.ok ? accepted({ surface: { ...neutral.value, skills: sessions.value },
      runtime: captured.value, companions: memory.value }) : memory;
  };
};

const hostProjector = (ports: {
  readonly projection: BuildProjection; readonly capture: CaptureFullHost;
  readonly hosts: HostBuildTable; readonly readDistribution: ReadHostDistribution;
}): ProjectHost => {
  return async (request) => {
    const members = ports.hosts.find((candidate) => candidate.host.distribution === request.host.distribution);
    const distribution = ports.readDistribution({ host: request.host });
    if (!distribution.ok) return distribution;
    if (!members) return refused([{ kind: "unknown-harness", harness: request.host.distribution }]);
    const missing = members.placements.find((placement) => !request.files.some((file) => file.source === placement.source));
    if (missing) return refused([{ kind: "render-failed", concept: "host-data", name: missing.source,
      reason: "The declared authored host file was not captured." }]);
    const compiled = request.core.project({ name: request.host.distribution, directory: request.host.directory,
      memoryRoot: DEFAULT_WORKSPACE.memory });
    if (!compiled.ok) return refused([compiled.refusal]);
    const captured = await ports.capture(request.core);
    if (!captured.ok) return captured;
    const assembled = await ports.projection.assembleHarness({ method: request.core.method,
      sources: request.core.sources, host: request.host,
      renderers: { agents: members.agents.render, skills: members.skills.render,
        settings: members.settings.render, documents: members.documents.render, data: members.renderData,
        placements: members.placements, commandPlacement: members.commands },
      files: request.files, prepare: request.prepare, tokens: request.tokens, channel: request.channel,
      modelCap: request.modelCap, entrypoints: request.entrypoints, fills: members.fills,
      bindingHeadings: hostBindingHeadings(), projectRoot: request.projectRoot,
      reviewerAgents: request.reviewerAgents, runtime: captured.value.runtime, compiled: compiled.value });
    if (!assembled.ok) return assembled;
    const projected = createHostedMethodProjection({ host: request.host, harness: assembled.value }).project({
      harness: request.host.distribution, method: request.core.method, sources: request.core.sources,
      surface: captured.value.surface, runtime: captured.value.runtime, compiled: compiled.value,
      companions: captured.value.companions,
      hostFiles: request.files.filter((file) => members.placements.some((placement) => placement.source === file.source)),
    });
    return projected.ok ? accepted({ host: { host: request.host, harness: assembled.value,
      layout: distribution.value.layout }, projection: projected.value }) : projected;
  };
};
const distributionReader = (request: {
  readonly hosts: HostBuildTable;
  readonly projection: Pick<BuildProjection, "delegateShellFacts">;
}): ReadHostDistribution => ({ host }) => {
  const members = request.hosts.find((candidate) => candidate.host.distribution === host.distribution
    && candidate.host.directory === host.directory);
  if (!members?.distribution) return refused([{ kind: "unknown-harness", harness: host.distribution }]);
  const distribution = members.distribution({ delegateShellFacts: request.projection.delegateShellFacts });
  return distribution.ok ? distribution : refused([distribution.refusal]);
};
export const createPackageBuildRoot: CreatePackageBuildRoot = (request) => {
  const loading = createAuthoredMethodLoading({ reader: request.platform.fileSystem,
    parser: request.platform.yaml, outliner: request.outliner });
  const projection = createBuildProjection({ hostFiles: request.platform.fileSystem, sessionFiles: request.platform.fileSystem,
    runnerProcess: request.platform.processRunner, runnerScratch: request.platform.fileSystem,
    runnerFrames: request.runnerFrames, runnerChild: new URL("./legacy-runner-child.ts", import.meta.url) });
  const readSessions = sessionReading({ projection, core: request.sources.core });
  const readNeutral = neutralReading({ projection, core: request.sources.core });
  const readDistribution = distributionReader({ hosts: request.hosts, projection });
  let core: MethodReading<CoreBuild> | undefined;
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: (target) => projectFor({ authored: loaded.value, target }, projection.serializeMethod) }) : loaded;
  };
  return {
    readHostDistribution: readDistribution,
    projectHost: hostProjector({ projection, hosts: request.hosts, readDistribution,
      capture: fullHostCapture({ projection, core: request.sources.core, stamp: createBuildPackaging().stamp,
        readSessions, readNeutral }) }),
    projectDocuments: documentsProjector({ projection, readNeutral }),
    loadCore: () => core ??= loadCore(),
    loadPlugins: ({ core: loaded }) => loading.loadPlugins({ core: loaded,
      pluginsRoot: request.sources.plugins }),
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: (host) => captureHost(host, projection),
    projectSettings: (settings) => {
      const members = hostSettingsMembers(settings.host);
      if (!members.ok) return members;
      return members.value === null ? accepted([])
        : projection.projectSettings({ ...settings, render: members.value.render });
    },
    projectHostSurface: (surface) => {
      const members = hostSurfaceMembers(surface.host);
      return members === null ? accepted([]) : projection.projectHostSurface({ ...surface,
        renderData: members.renderData, placements: members.placements });
    },
    projectSkills: async (skills) => {
      const members = hostSkillMembers(skills.host);
      if (!members.ok) return members;
      if (members.value === null) return accepted([]);
      const captured = await readSessions();
      const source = sourcePath("skills");
      if (!source.ok) return refused({ kind: "render-failed", concept: "session-skill",
        name: "skills", reason: "The session source path is invalid." });
      if (!captured.ok) return refused(captured.refusal[0] ?? {
        kind: "neutral-source-unreadable", source: source.value, reason: "The session source was refused." });
      return projection.projectSkills({ ...skills, render: members.value.render, sessions: captured.value });
    },
    projectAgents: (agents) => {
      const members = hostAgentMembers(agents.host);
      if (!members.ok) return members;
      return members.value === null ? accepted([])
        : projection.projectAgents({ ...agents, render: members.value.render });
    },
  };
};
