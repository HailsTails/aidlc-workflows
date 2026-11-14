import { createBuildPackaging, createReleaseArtifacts, type BuildPackaging, type BuildReleaseArtifact } from "../packaging/core-root.ts";
import { channelTokens } from "../packaging/domain/channel-tokens.ts";
import { bindCopiedSource } from "../projection/domain/source-binding.ts";
import { prepareHostSource } from "../projection/application/prepared-host-source.ts";
import { requiredHostSources } from "../projection/application/host-source-files.ts";
import type { Payload } from "../packaging/domain/payload.ts";
import { createPluginBuildRoute } from "./adapters/routes/build/plugin-route.ts";
import { createPluginBuilds } from "./adapters/routes/build/plugin-builds.ts";
import { reviewerAgentSet } from "../workflow-definition/domain/method-participation.ts";
import type { ContentHasher } from "../packaging/application/ports.ts";
import { DEFAULT_WORKSPACE } from "../projection/domain/workspace.ts";
import type { MemoryCompanion, SharedRuntime } from "../projection/domain/neutral-surface.ts";
import type { NeutralSurface } from "../projection/domain/neutral-surface.ts";
import type { SessionSkill } from "../projection/domain/neutral-surface.ts";
import type { BuildProjection } from "../projection/application/ports/build-projection.ts";
import { accepted, refused } from "../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal, type SourcePath } from "../kernel/values.ts";
import type { Result } from "../kernel/result.ts";
import { createAuthoredMethodLoading } from "../workflow-definition/core-root.ts";
import type { AuthoredCoreMethod, AuthoredPluginBuild, PluginBuildTarget, MethodReading } from "../workflow-definition/application/ports.ts";
import { createBuildProjection, createHostedMethodProjection } from "../projection/core-root.ts";
import type { CompiledMethodFiles } from "../projection/domain/projection.ts";
import type { CoreBuild, CoreBuildTarget, CreatePackageBuildRoot,
  CapturedHostSources, HostSourcesRequest, HostBuildTable, HostModule, ReadHostDistribution,
  ProjectHost, BuildPayload, BuildPlugins, PackageBuildRoot, ReleaseArchivesRequest, ReleaseArchives } from "./roots.ts";
import type { ArchiveFile, PackagingRefusal } from "../packaging/domain/artifact.ts";
import type { AgentSlug } from "../workflow-definition/domain/identities.ts";
import type { HostIdentity } from "../kernel/host.ts";
import type { HarnessRenderers } from "../projection/application/ports/harness-assembly.ts";
import type { Projection, ProjectionRefusal } from "../projection/domain/projection.ts";
import { pluginAuthoringFiles } from "../projection/application/plugin-authoring-files.ts";
import { collectCommandRenderings } from "../projection/application/command-renderers.ts";
import { readEveryEntry, type TreeFile, type FileSystem } from "../kernel/file-system-port.ts";
import type { HostedPluginTarget } from "../projection/application/ports/plugins.ts";

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
    const required = [...capture.required, ...(members ? requiredHostSources(members.projection) : [])];
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

const payloadBuilder = (ports: {
  readonly projectHost: ProjectHost; readonly hosts: HostBuildTable; readonly packaging: BuildPackaging;
  readonly readDistribution: ReadHostDistribution; readonly hasher: ContentHasher;
  readonly projection: Pick<BuildProjection, "delegateShellFacts">;
  readonly readPluginTemplates: () => Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>>;
  readonly readPluginTargets: () => Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]>;
}): BuildPayload => async (request) => {
  const built = await ports.projectHost(request);
  if (!built.ok) return built;
  const members = memberFor(ports.hosts, request.host);
  const distribution = ports.readDistribution({ host: request.host });
  if (!members) return refused([{ kind: "unknown-harness", harness: request.host.distribution }]);
  if (!distribution.ok) return distribution;
  const hostData = members.projection.renderData({ delegateShellFacts: ports.projection.delegateShellFacts });
  const completed = await authoringProjection({
    ...ports, projection: built.value.projection, method: request.core.method, directory: request.host.directory,
  });
  if (!completed.ok) return completed;
  return ports.packaging.packageHost({ hasher: ports.hasher, distribution: distribution.value, hostData,
    projection: completed.value, channel: request.channel, copy: request.copy });
};

const authoringProjection = async (request: {
  readonly projection: Projection; readonly method: CoreBuild["method"]; readonly directory: HostIdentity["directory"];
  readonly readPluginTemplates: () => Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>>;
  readonly readPluginTargets: () => Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]>;
}): Promise<Result<Projection, readonly (KernelRefusal | ProjectionRefusal)[]>> => {
  const templates = await request.readPluginTemplates();
  if (!templates.ok) return templates;
  const targets = request.readPluginTargets();
  if (!targets.ok) return targets;
  const files = collectCommandRenderings([accepted(request.projection.files), accepted(pluginAuthoringFiles({
    method: request.method, targets: targets.value, templates: templates.value, directory: request.directory,
  }))]);
  return files.ok ? accepted({ ...request.projection, files: files.value }) : refused([files.refusal]);
};

const pluginTargetReading = ({ hosts, readDistribution }: {
  readonly hosts: HostBuildTable; readonly readDistribution: ReadHostDistribution;
}): (() => Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]>) => {
  let captured: Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]> | undefined;
  const read = (): Result<readonly HostedPluginTarget[], readonly (KernelRefusal | ProjectionRefusal)[]> => {
    const readings = [...hosts].sort((left, right) =>
      left.host.distribution.localeCompare(right.host.distribution)).map((module) => {
      const target = readDistribution({ host: module.host });
      return target.ok ? accepted({ host: module.host, target: target.value.plugin }) : target;
    });
    const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
    return failures.length > 0 ? refused(failures)
      : accepted(readings.flatMap((reading) => reading.ok ? [reading.value] : []));
  };
  return () => captured ??= read();
};

const pluginTemplateReading = ({ fileSystem, folder }: {
  readonly fileSystem: Pick<FileSystem, "readTree">; readonly folder: URL;
}): (() => Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>>) => {
  let captured: Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>> | undefined;
  const read = async (): Promise<Result<readonly TreeFile[], readonly ProjectionRefusal[]>> => {
    const reading = await fileSystem.readTree({ folder, select: readEveryEntry });
    if (!reading.ok) return refused([{ kind: "plugin-hook-template-unreadable", within: "", code: reading.refusal.code }]);
    return reading.value.unreadable.length > 0 ? refused(reading.value.unreadable.map((failure) => ({
      kind: "plugin-hook-template-unreadable", ...failure,
    }))) : accepted(reading.value.files);
  };
  return () => captured ??= read();
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

const projectPlugin = (ports: {
  readonly projection: Pick<BuildProjection, "plugins">; readonly readDistribution: ReadHostDistribution;
  readonly sources: URL;
}, request: { readonly plugin: PluginBuildTarget; readonly host: HostIdentity;
  readonly output: URL; readonly boundary: URL; readonly reviewerAgents: ReadonlySet<string>;
}): Result<URL, readonly (KernelRefusal | ProjectionRefusal)[]> => {
  const distribution = ports.readDistribution({ host: request.host });
  if (!distribution.ok) return distribution;
  const emitted = ports.projection.plugins.project({ plugin: request.plugin.plugin,
    pluginFolder: new URL(`${encodeURIComponent(request.plugin.directory)}/`, ports.sources),
    host: request.host, target: distribution.value.plugin, output: request.output,
    boundary: request.boundary, reviewerAgents: request.reviewerAgents });
  return emitted.ok ? emitted : refused([emitted.refusal]);
};

const pluginCatalogues = (ports: {
  readonly projection: Pick<BuildProjection, "plugins">; readonly readDistribution: ReadHostDistribution;
}, request: { readonly output: URL; readonly hosts: readonly HostIdentity[] }):
  Result<readonly string[], readonly (KernelRefusal | ProjectionRefusal)[]> => {
  const readings = request.hosts.map((host) => {
    const distribution = ports.readDistribution({ host });
    return distribution.ok ? accepted({ host, target: distribution.value.plugin }) : distribution;
  });
  const failures = readings.flatMap((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const written = ports.projection.plugins.writeCatalogues({ output: request.output,
    targets: readings.flatMap((reading) => reading.ok ? [reading.value] : []) });
  return written.ok ? written : refused([written.refusal]);
};

const releaseEntrypoints = async (request: Parameters<CreatePackageBuildRoot>[0]) => {
  const listings = await Promise.all(["hooks", "tools"].map(async (folder) => {
    const source = sourcePath(folder);
    if (!source.ok) return refused([source.refusal]);
    const reading = await request.platform.fileSystem.listFolder({ folder: new URL(`${folder}/`, request.sources.core) });
    return reading.ok ? accepted(reading.value.filter((entry) => entry.kind === "file" && entry.name.endsWith(".ts"))
      .map((entry) => sourcePath(`${folder}/${entry.name}`))) : refused([{ kind: "neutral-source-unreadable" as const,
      source: source.value, reason: reading.refusal.code }]);
  }));
  const failures = listings.flatMap<KernelRefusal | ProjectionRefusal>((reading) => reading.ok ? [] : reading.refusal);
  if (failures.length > 0) return refused(failures);
  const paths = listings.flatMap((reading) => reading.ok ? reading.value : []);
  const invalid = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
  return invalid.length > 0 ? refused(invalid) : accepted(paths.flatMap((path) => path.ok ? [path.value] : []).sort());
};

const releaseHostPair = async (ports: {
  readonly root: PackageBuildRoot; readonly request: Parameters<CreatePackageBuildRoot>[0];
  readonly projection: BuildProjection; readonly core: CoreBuild; readonly entrypoints: readonly SourcePath[];
  readonly reviewerAgents: ReadonlySet<AgentSlug>; readonly members: HostModule;
  readonly release: ReleaseArchivesRequest;
}) => {
  const { members, root } = ports;
  const captured = await root.readHostSources({ name: members.host.distribution, directory: members.host.directory,
    root: new URL(`../harness/${members.host.distribution}/`, ports.request.sources.core), copied: [], required: [] });
  if (!captured.ok) return captured;
  const build = (channel: "copy" | "native", copy: Payload | null) => {
    const tokens = { ...members.projection.tokens, ["HARNESS_DIR"]: members.host.directory,
      ...channelTokens({ channel, directory: members.host.directory,
        prefix: ports.projection.nativeCommands.prefix, namespace: ports.projection.nativeCommands.namespace }) };
    return root.buildPayload({ host: captured.value.host, core: ports.core, files: captured.value.files,
      prepare: (file) => prepareHostSource({ host: captured.value.host, file,
        steps: [(content) => bindCopiedSource({ source: file.source, content, tokens })] }),
      tokens, channel, modelCap: ports.release.modelCap, entrypoints: ports.entrypoints, reviewerAgents: ports.reviewerAgents, copy,
      projectRoot: new URL(`../${channel === "copy" ? "dist" : "dist-release"}/${members.host.distribution}`, ports.request.sources.core) });
  };
  const copy = await build("copy", null);
  if (!copy.ok) return copy;
  const native = await build("native", copy.value);
  return native.ok ? accepted({ copy: copy.value, native: native.value }) : native;
};

const releasePayloads = (ports: Omit<Parameters<typeof releaseHostPair>[0], "members">) => {
  const empty: { readonly copies: readonly Payload[]; readonly natives: readonly Payload[] } = { copies: [], natives: [] };
  return [...ports.request.hosts].sort((a, b) => a.host.distribution.localeCompare(b.host.distribution))
    .reduce<Promise<Result<typeof empty, readonly (KernelRefusal | ProjectionRefusal | PackagingRefusal)[]>>>(
      async (pending, members) => {
        const accumulated = await pending;
        if (!accumulated.ok) return accumulated;
        const pair = await releaseHostPair({ ...ports, members });
        return pair.ok ? accepted({ copies: [...accumulated.value.copies, pair.value.copy],
          natives: [...accumulated.value.natives, pair.value.native] }) : pair;
      }, Promise.resolve(accepted(empty)));
};

const writeReleaseArchives = async ({ artifacts, release, pairs }: {
  readonly artifacts: { readonly build: BuildReleaseArtifact["build"];
    readonly readPlugins: (root: URL) => Promise<Result<readonly ArchiveFile[], readonly PackagingRefusal[]>> };
  readonly release: ReleaseArchivesRequest;
  readonly pairs: { readonly copies: readonly Payload[]; readonly natives: readonly Payload[] };
}): Promise<Result<ReleaseArchives, readonly PackagingRefusal[]>> => {
  const additions = await artifacts.readPlugins(release.pluginTrees);
  if (!additions.ok) return additions;
  const runtime = await artifacts.build({ name: release.names.runtime, format: "tar.gz", payloads: pairs.natives,
    additions: additions.value });
  if (!runtime.ok) return runtime;
  const copyRuntime = await artifacts.build({ name: release.names.copyRuntime, format: "tar.gz", payloads: pairs.copies,
    additions: additions.value });
  return copyRuntime.ok ? accepted({ runtime: runtime.value, copyRuntime: copyRuntime.value }) : copyRuntime;
};

const releaseArchives = (ports: {
  readonly request: Parameters<CreatePackageBuildRoot>[0]; readonly root: () => PackageBuildRoot;
  readonly packaging: BuildPackaging; readonly projection: BuildProjection;
}) => async (release: ReleaseArchivesRequest) => {
  if (!ports.packaging.version.ok) return refused([ports.packaging.version.refusal]);
  if (ports.packaging.version.value !== release.stampedAs) return refused([{
    kind: "mixed-versions" as const, versions: [ports.packaging.version.value, release.stampedAs] as const,
  }]);
  const root = ports.root();
  const loaded = await root.loadCore();
  if (!loaded.ok) return loaded;
  const plugins = await root.loadPlugins({ core: loaded.value });
  if (!plugins.ok) return plugins;
  const entrypoints = await releaseEntrypoints(ports.request);
  if (!entrypoints.ok) return entrypoints;
  const pairs = await releasePayloads({ ...ports, release, root, core: loaded.value, entrypoints: entrypoints.value,
    reviewerAgents: reviewerAgentSet(plugins.value.method) });
  if (!pairs.ok) return pairs;
  const artifacts = createReleaseArtifacts({ folder: release.archives,
    fileSystem: ports.request.platform.fileSystem, hasher: ports.request.platform.digester });
  return writeReleaseArchives({ artifacts, release, pairs: pairs.value });
};

export const createPackageBuildRoot: CreatePackageBuildRoot = (request) => {
  const loading = createAuthoredMethodLoading({ reader: request.platform.fileSystem,
    parser: request.platform.yaml, outliner: request.outliner });
  const projection = createBuildProjection({ hostFiles: request.platform.fileSystem, sessionFiles: request.platform.fileSystem,
    plugins: request.plugins,
    runnerProcess: request.platform.processRunner, runnerScratch: request.platform.fileSystem,
    runnerFrames: request.runnerFrames, runnerChild: new URL("./legacy-runner-child.ts", import.meta.url) });
  const readSessions = sessionReading({ projection, core: request.sources.core });
  const readNeutral = neutralReading({ projection, core: request.sources.core });
  const readDistribution = distributionReader({ hosts: request.hosts, projection });
  const packaging = createBuildPackaging({ routes: projection.nativeCommands, historyReader: request.platform.fileSystem,
    copyEraSource: new URL("../scripts/copy-era-files.json", request.sources.core) });
  let core: MethodReading<CoreBuild> | undefined;
  let pluginMethod: AuthoredPluginBuild | null = null;
  const loadCore = async (): MethodReading<CoreBuild> => {
    const loaded = await loading.loadCore(request.sources.core);
    return loaded.ok ? accepted({ ...loaded.value,
      project: (target) => projectFor({ authored: loaded.value, target }, projection.serializeMethod) }) : loaded;
  };
  const projectHost = hostProjector({ projection, hosts: request.hosts, readDistribution,
    capture: fullHostCapture({ projection, core: request.sources.core, readSessions, readNeutral }) });
  const buildPlugins: BuildPlugins = (build) => {
    const captured = pluginMethod;
    return captured ? createPluginBuilds({ terminal: request.platform.terminal,
      emit: (plugin) => projectPlugin({ projection, readDistribution, sources: request.sources.plugins },
        { ...plugin, reviewerAgents: reviewerAgentSet(captured.method) }),
      catalogues: (catalogues) => pluginCatalogues({ projection, readDistribution }, catalogues),
    })(build) : refused([{ kind: "render-failed", concept: "host-data", name: "plugin-build",
      reason: "Load the plugin Method before building its projections." }]);
  };
  const root: PackageBuildRoot = {
    settingsCapabilities: projection.settingsCapabilities, readHostDistribution: readDistribution,
    projectHost,
    buildPlugins,
    buildReleaseArchives: releaseArchives({ request, root: () => root, packaging, projection }),
    buildRoutes: () => [createPluginBuildRoute({ root, hosts: request.hosts.map((module) => module.host),
      terminal: request.platform.terminal, workingDirectory: request.workingDirectory,
      emit: (plugin) => {
        const emitted = projectPlugin({ projection, readDistribution, sources: request.sources.plugins },
          { ...plugin, boundary: plugin.output });
        return emitted.ok ? accepted(undefined) : refused(emitted.refusal
          .map((failure) => "reason" in failure ? failure.reason : JSON.stringify(failure)).join("\n"));
      } })],
    buildPayload: payloadBuilder({ projectHost, hosts: request.hosts, packaging, readDistribution, projection,
      hasher: request.platform.digester, readPluginTemplates: pluginTemplateReading({
        fileSystem: request.platform.fileSystem, folder: request.sources.pluginHookTemplates }),
      readPluginTargets: pluginTargetReading({ hosts: request.hosts, readDistribution }) }),
    loadCore: () => core ??= loadCore(),
    loadPlugins: async ({ core: loaded }) => {
      const captured = await loading.loadPlugins({ core: loaded, pluginsRoot: request.sources.plugins });
      if (captured.ok) pluginMethod = captured.value;
      return captured;
    },
    prepareCommandSource: ({ core: loaded, ...command }) => projection.prepareCommandSource({ ...command,
      method: loaded.method, sources: loaded.sources }),
    readHostSources: (host) => captureHost(host, { hosts: request.hosts, projection }),
  };
  return root;
};
