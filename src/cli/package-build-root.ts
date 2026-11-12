import { createBuildPackaging, type BuildPackaging } from "../packaging/core-root.ts";
import type { ContentHasher } from "../packaging/application/ports.ts";
import { DEFAULT_WORKSPACE } from "../projection/domain/workspace.ts";
import type { MemoryCompanion, SharedRuntime } from "../projection/domain/neutral-surface.ts";
import type { VersionStamp } from "../packaging/application/boundary-ports.ts";
import type { ProjectDocuments } from "./roots.ts";
import type { NeutralSurface } from "../projection/domain/neutral-surface.ts";
import type { SessionSkill } from "../projection/domain/neutral-surface.ts";
import type { BuildProjection } from "../projection/application/ports/build-projection.ts";
import { accepted, refused } from "../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal } from "../kernel/values.ts";
import type { Result } from "../kernel/result.ts";
import { createAuthoredMethodLoading } from "../workflow-definition/core-root.ts";
import type { AuthoredCoreMethod, MethodReading } from "../workflow-definition/application/ports.ts";
import { createBuildProjection, createHostedMethodProjection } from "../projection/core-root.ts";
import type { CompiledMethodFiles, Projection } from "../projection/domain/projection.ts";
import type { ProjectedFile } from "../projection/domain/projected-file.ts";
import type { CoreBuild, CoreBuildTarget, CreatePackageBuildRoot, PackageBuildRoot,
  CapturedHostSources, HostSourcesRequest, HostBuildTable, HostModule, ReadHostDistribution,
  ProjectHost, BuildPayload } from "./roots.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { HarnessRenderers } from "../projection/application/ports/harness-assembly.ts";
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


const renderersOf = ({ projection }: HostModule): HarnessRenderers => ({
  agents: projection.agents.render, skills: projection.skills.render, settings: projection.settings.render,
  documents: projection.documents.render, data: projection.renderData, placements: projection.placements,
  commandPlacement: projection.commands, ...(projection.derive ? { derive: projection.derive } : {}) });

const memberFor = (hosts: HostBuildTable, host: HostIdentity): HostModule | undefined =>
  hosts.find((candidate) => candidate.host.distribution === host.distribution);

const bindingHeadingsOf = (hosts: HostBuildTable): readonly string[] =>
  hosts.map((module) => module.projection.bindingHeading);

const captureHost = async (capture: HostSourcesRequest,
  request: { readonly hosts: HostBuildTable; readonly projection: Pick<BuildProjection, "readHostSources"> }):
    Promise<Result<CapturedHostSources, readonly (KernelRefusal | ProjectionRefusal)[]>> => {
    const distribution = distributionId(capture.name);
    if (!distribution.ok) return refused([distribution.refusal]);
    const directory = projectPath(capture.directory);
    if (!directory.ok) return refused([directory.refusal]);
    const host = { distribution: distribution.value, directory: directory.value };
    const members = memberFor(request.hosts, host);
    const required = [...capture.required, ...(members?.projection.skills.inputs ?? []), ...(members?.projection.settings.inputs ?? []),
      ...(members?.projection.placements.map((placement) => placement.source) ?? [])];
    const paths = [...new Set([...capture.copied, ...required])].map(sourcePath);
    const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
    if (failures.length > 0) return refused(failures);
    const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
    const files = await request.projection.readHostSources({ root: capture.root, host, sources,
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
  readonly projection: BuildProjection; readonly readNeutral: CoreNeutralCapture; readonly hosts: HostBuildTable;
}): ProjectDocuments => async (documents) => {
  const members = memberFor(request.hosts, documents.host)?.projection.documents;
  if (members === undefined) return accepted([]);
  const surface = await request.readNeutral(documents.core);
  if (!surface.ok) return surface;
  const rendered = request.projection.projectDocuments({ method: documents.core.method,
    host: documents.host, render: members.render, surface: surface.value,
    fills: documents.fills, tokens: documents.tokens, bindingHeadings: bindingHeadingsOf(request.hosts) });
  return rendered.ok ? rendered : refused([rendered.refusal]);
};

type FullHostCapture = {
  readonly surface: NeutralSurface; readonly runtime: SharedRuntime; readonly companions: readonly MemoryCompanion[];
};
type CaptureFullHost = (core: CoreBuild) => Promise<Result<FullHostCapture, readonly ProjectionRefusal[]>>;

const fullHostCapture = (ports: {
  readonly projection: BuildProjection; readonly core: URL;
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
      method: core.method }));
    if (!captured.ok) return captured;
    const memory = await (companions ??= ports.projection.readMemoryCompanions({ core: ports.core }));
    return memory.ok ? accepted({ surface: { ...neutral.value, skills: sessions.value },
      runtime: captured.value, companions: memory.value }) : memory;
  };
};

const stampedFile = (file: ProjectedFile, stamp: VersionStamp): Result<ProjectedFile, ProjectionRefusal> => {
  if (file.origin.kind !== "runtime-data" || file.origin.name !== "version-module") return accepted(file);
  const stamped = stamp(file.content);
  return stamped.ok ? accepted({ ...file, content: stamped.value })
    : refused({ kind: "render-failed", concept: "host-data", name: "aidlc-version.ts",
      reason: stamped.refusal.kind === "version-unstampable" ? stamped.refusal.reason : stamped.refusal.kind });
};

const stampedProjection = (projection: Projection, stamp: VersionStamp): Result<Projection, ProjectionRefusal> => {
  const files = projection.files.map((file) => stampedFile(file, stamp));
  const failed = files.find((file) => !file.ok);
  return failed && !failed.ok ? failed
    : accepted({ ...projection, files: files.flatMap((file) => file.ok ? [file.value] : []) });
};

const stampingVersion = (projectHost: ProjectHost, stamp: VersionStamp): ProjectHost => async (request) => {
  const built = await projectHost(request);
  if (!built.ok) return built;
  const stamped = stampedProjection(built.value.projection, stamp);
  return stamped.ok ? accepted({ ...built.value, projection: stamped.value }) : refused([stamped.refusal]);
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
    const missing = members.projection.placements.find((placement) => !request.files.some((file) => file.source === placement.source));
    if (missing) return refused([{ kind: "render-failed", concept: "host-data", name: missing.source,
      reason: "The declared authored host file was not captured." }]);
    const compiled = request.core.project({ name: request.host.distribution, directory: request.host.directory,
      memoryRoot: DEFAULT_WORKSPACE.memory });
    if (!compiled.ok) return refused([compiled.refusal]);
    const captured = await ports.capture(request.core);
    if (!captured.ok) return captured;
    const assembled = await ports.projection.assembleHarness({ method: request.core.method,
      sources: request.core.sources, host: request.host,
      renderers: renderersOf(members),
      files: request.files, prepare: request.prepare, tokens: request.tokens, channel: request.channel,
      modelCap: request.modelCap, entrypoints: request.entrypoints, fills: members.projection.fills,
      bindingHeadings: bindingHeadingsOf(ports.hosts), projectRoot: request.projectRoot,
      reviewerAgents: request.reviewerAgents, runtime: captured.value.runtime, compiled: compiled.value });
    if (!assembled.ok) return assembled;
    const projected = createHostedMethodProjection({ host: request.host, harness: assembled.value }).project({
      harness: request.host.distribution, method: request.core.method, sources: request.core.sources,
      surface: captured.value.surface, runtime: captured.value.runtime, compiled: compiled.value,
      companions: captured.value.companions,
      hostFiles: request.files.filter((file) => members.projection.placements.some((placement) => placement.source === file.source)),
    });
    return projected.ok ? accepted({ host: { host: request.host, harness: assembled.value,
      layout: distribution.value.layout }, projection: projected.value }) : projected;
  };
};
const onboardingOf = (projection: Projection, directory: string) => {
  const rendered = projection.files.filter((file) => file.origin.kind === "rendered"
    && file.origin.concept === "onboarding");
  return (rendered.find((file) => file.path.startsWith(`${directory}/`)) ?? rendered[0])?.path;
};

const payloadBuilder = (ports: {
  readonly projectHost: ProjectHost; readonly hosts: HostBuildTable; readonly packaging: BuildPackaging;
  readonly readDistribution: ReadHostDistribution; readonly hasher: ContentHasher;
  readonly projection: Pick<BuildProjection, "delegateShellFacts">;
}): BuildPayload => async (request) => {
  const built = await ports.projectHost(request);
  if (!built.ok) return built;
  const members = memberFor(ports.hosts, request.host);
  const distribution = ports.readDistribution({ host: request.host });
  if (!members) return refused([{ kind: "unknown-harness", harness: request.host.distribution }]);
  if (!distribution.ok) return distribution;
  if (!ports.packaging.version.ok) return refused([ports.packaging.version.refusal]);
  const hostData = members.projection.renderData({ delegateShellFacts: ports.projection.delegateShellFacts });
  const packaged = await ports.packaging.packagerFor({ hasher: ports.hasher, distribution: distribution.value,
    hostData, onboarding: onboardingOf(built.value.projection, request.host.directory),
  }).package({ projection: built.value.projection, channel: request.channel,
    version: ports.packaging.version.value, runtime: [] });
  return packaged;
};

const distributionReader = (request: {
  readonly hosts: HostBuildTable;
  readonly projection: Pick<BuildProjection, "delegateShellFacts">;
}): ReadHostDistribution => ({ host }) => {
  const members = request.hosts.find((candidate) => candidate.host.distribution === host.distribution
    && candidate.host.directory === host.directory);
  if (!members) return refused([{ kind: "unknown-harness", harness: host.distribution }]);
  const distribution = members.distribution({ delegateShellFacts: request.projection.delegateShellFacts });
  return distribution.ok ? distribution : refused([distribution.refusal]);
};
type ConceptProjectors = Pick<PackageBuildRoot, "projectSettings" | "projectHostSurface" | "projectSkills" | "projectAgents">;

const conceptProjectors = (request: {
  readonly hosts: HostBuildTable; readonly projection: BuildProjection; readonly readSessions: SessionReading;
}): ConceptProjectors => {
  const { hosts, projection, readSessions } = request;
  return {
    projectSettings: (settings) => {
      const members = memberFor(hosts, settings.host);
      return members === undefined ? accepted([])
        : projection.projectSettings({ ...settings, render: members.projection.settings.render });
    },
    projectHostSurface: (surface) => {
      const members = memberFor(hosts, surface.host);
      return members === undefined ? accepted([]) : projection.projectHostSurface({ ...surface,
        renderData: members.projection.renderData, placements: members.projection.placements });
    },
    projectSkills: async (skills) => {
      const members = memberFor(hosts, skills.host);
      if (members === undefined) return accepted([]);
      const captured = await readSessions();
      const source = sourcePath("skills");
      if (!source.ok) return refused({ kind: "render-failed", concept: "session-skill",
        name: "skills", reason: "The session source path is invalid." });
      if (!captured.ok) return refused(captured.refusal[0] ?? {
        kind: "neutral-source-unreadable", source: source.value, reason: "The session source was refused." });
      return projection.projectSkills({ ...skills, render: members.projection.skills.render, sessions: captured.value });
    },
    projectAgents: (agents) => {
      const members = memberFor(hosts, agents.host);
      return members === undefined ? accepted([])
        : projection.projectAgents({ ...agents, render: members.projection.agents.render });
    },
  };
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
  const packaging = createBuildPackaging();
  let core: MethodReading<CoreBuild> | undefined;
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: (target) => projectFor({ authored: loaded.value, target }, projection.serializeMethod) }) : loaded;
  };
  const projectHost = stampingVersion(hostProjector({ projection, hosts: request.hosts, readDistribution,
    capture: fullHostCapture({ projection, core: request.sources.core, readSessions, readNeutral }) }),
    packaging.stamp);
  return {
    settingsCapabilities: projection.settingsCapabilities, readHostDistribution: readDistribution,
    projectHost,
    buildPayload: payloadBuilder({ projectHost, hosts: request.hosts, packaging, readDistribution, projection,
      hasher: request.platform.digester }),
    projectDocuments: documentsProjector({ projection, readNeutral, hosts: request.hosts }),
    loadCore: () => core ??= loadCore(),
    loadPlugins: ({ core: loaded }) => loading.loadPlugins({ core: loaded,
      pluginsRoot: request.sources.plugins }),
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: (host) => captureHost(host, { hosts: request.hosts, projection }),
    ...conceptProjectors({ hosts: request.hosts, projection, readSessions }),
  };
};
